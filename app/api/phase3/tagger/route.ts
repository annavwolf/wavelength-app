import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { MODELS } from "@/lib/models";
import type { SituationTag } from "@/types/database";

const MODEL = MODELS.interpret;
const MAX_TOKENS = 128;

const VALID_TAGS: SituationTag[] = ["meeting", "async_chat", "email", "document", "project_task", "other"];

const TAG_TOOL: Anthropic.Tool = {
  name: "tag_story",
  description: "Tag a story with one context category.",
  input_schema: {
    type: "object",
    properties: {
      tag: {
        type: "string",
        enum: VALID_TAGS,
        description: "The context category that best fits this story.",
      },
    },
    required: ["tag"],
  },
};

async function tagStory(storyText: string, apiKey: string): Promise<SituationTag> {
  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: `You are tagging team-member stories with one context category. Choose the best fit:
- meeting: real-time group interaction (video call, in-person meeting, standup, etc.)
- async_chat: instant messages, Slack, Teams, text threads
- email: email correspondence
- document: shared doc, PR review, written feedback, comment thread on a file
- project_task: a piece of work, deadline, deliverable, or process (not primarily communication)
- other: does not fit any above`,
    tools: [TAG_TOOL],
    tool_choice: { type: "tool", name: "tag_story" },
    messages: [{ role: "user", content: `Story: "${storyText.slice(0, 600)}"` }],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "tag_story"
  );
  const tag = (toolUse?.input as { tag?: SituationTag } | undefined)?.tag;
  return VALID_TAGS.includes(tag as SituationTag) ? tag as SituationTag : "other";
}

// POST /api/phase3/tagger  { team_id }
// Runs after Phase 3 submissions are complete. Tags all untagged stories for the team.
// Safe to re-run — skips stories that already have a tag.
export async function POST(req: NextRequest) {
  let teamId: string;
  try {
    const body = await req.json();
    teamId = body.team_id;
    if (!teamId) return NextResponse.json({ error: "team_id required" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI service not configured" }, { status: 500 });

  const { data: stories, error } = await supabase
    .from("member_stories")
    .select("id, story_text")
    .eq("team_id", teamId)
    .is("situation_tag", null);

  if (error) return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  if (!stories || stories.length === 0) return NextResponse.json({ tagged: 0 });

  let tagged = 0;
  const failures: string[] = [];

  for (const story of stories) {
    try {
      const tag = await tagStory(story.story_text, apiKey);
      await supabase
        .from("member_stories")
        .update({ situation_tag: tag, updated_at: new Date().toISOString() })
        .eq("id", story.id);
      tagged++;
    } catch (err) {
      failures.push(story.id);
      console.error("[phase3/tagger] failed to tag story:", story.id, err);
    }
  }

  return NextResponse.json({ tagged, failures: failures.length > 0 ? failures : undefined });
}

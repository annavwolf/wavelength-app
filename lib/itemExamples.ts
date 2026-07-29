// §4.8 — Item-specific behaviour examples (LOCKED).
// Keyed by ps_statements.statement_id (1–12).
// Three ALWAYS and three NEVER per item.
// Shown on the §4.4 transition screen and behind the collapsed expander in §4.5.

export type ItemExamples = {
  always: string[];
  never: string[];
};

export const ITEM_EXAMPLES: Record<number, ItemExamples> = {
  1: {
    always: ["Listen without interrupting", "Speak respectfully, even when disagreeing", "Thank people for their contributions"],
    never:  ["Interrupt or talk over people", "Mock, insult or belittle others", "Roll your eyes, scoff, or speak dismissively"],
  },
  2: {
    always: ["Ask for different perspectives", "Invite someone with a different viewpoint to share", "Ask questions to understand rather than judge"],
    never:  ["Dismiss someone's perspective because they're 'different'", "Make jokes about someone's background or differences", "Stereotype or label people"],
  },
  3: {
    always: ["Invite quieter people into discussions", "Include everyone in conversations and activities", "Learn and use people's names"],
    never:  ["Leave people out of conversations or decisions", "Form cliques that exclude others", "Ignore quieter team members"],
  },
  4: {
    always: ["Give credit where it's due", "Thank people for their help", "Build on another person's idea"],
    never:  ["Take credit for someone else's work", "Ignore someone's contribution", "Dismiss an idea without considering it"],
  },
  5: {
    always: ["Ask for help when you need it", "Offer help when someone is struggling", "Share your knowledge when someone asks"],
    never:  ["Struggle in silence", "Refuse to help others", "Make people feel stupid for asking for help"],
  },
  6: {
    always: ["Share ideas before they're fully worked out", "Think out loud", "Build on unfinished ideas instead of judging them"],
    never:  ["Shoot ideas down immediately", "Wait until an idea is 'perfect' before sharing", "Laugh at unfinished ideas"],
  },
  7: {
    always: ["Admit mistakes openly", "Raise concerns as soon as you notice them", "Thank people for speaking up"],
    never:  ["Hide mistakes", "Blame others for problems", "Criticize or punish people for admitting mistakes"],
  },
  8: {
    always: ["Listen without interrupting", "Ask 'Tell me more'", "Give people time to finish speaking"],
    never:  ["Interrupt people", "Change the subject before someone finishes", "Ignore what someone is trying to say"],
  },
  9: {
    always: ["Ask 'Is there a better way?'", "Suggest improvements", "Ask for feedback on how things could be improved"],
    never:  ["Shut down questions", "Say 'We've always done it this way' to end discussion", "Reject suggestions without discussion"],
  },
  10: {
    always: ["Ask 'What can we learn?'", "Share what you learned from a mistake", "Discuss what happened before deciding who was responsible"],
    never:  ["Look for someone to blame first", "Shame people for mistakes", "Stop people talking about failures"],
  },
  11: {
    always: ["Ask 'Does anyone see this differently?'", "Thank people who disagree respectfully", "Explore opposing viewpoints before deciding"],
    never:  ["Attack people for disagreeing", "Pressure everyone to agree", "Dismiss a different opinion without discussion"],
  },
  12: {
    always: ["Try new approaches when appropriate", "Be honest when something doesn't work", "Share what you learned from a failed attempt"],
    never:  ["Avoid trying anything new because it might fail", "Hide unsuccessful attempts", "Criticize people for trying something new"],
  },
};

-- Run quarterly during the beta. This is an intentionally manual review rather
-- than a silent deletion job: reports already generated may need a documented
-- withdrawal / retention decision before participant data is removed.
--
-- First, set teams.beta_participation_ended_at when that team's beta activity
-- ends. Then review the teams and members returned below with the data owner.

select
  t.team_id,
  t.team_name,
  t.beta_participation_ended_at,
  count(m.member_id) filter (where m.status <> 'opted_out') as retained_members,
  count(p.member_id) as acknowledged_members
from public.teams t
left join public.members m on m.team_id = t.team_id
left join public.member_privacy_acknowledgements p on p.team_id = t.team_id
where t.beta_participation_ended_at is not null
  and t.beta_participation_ended_at <= now() - interval '12 months'
group by t.team_id, t.team_name, t.beta_participation_ended_at
order by t.beta_participation_ended_at asc;

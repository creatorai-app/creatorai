-- Two dubbing posts quoted the pre-promo rate (3 credits per second, per-plan
-- dollars per minute and dubbing minutes). Public pages must not quote a dubbing
-- rate while the paid rate is a grant-funded promo, so the Creator AI figures are
-- replaced with the billing model and a link to /pricing. Mirrors blog-data.ts.
--
-- Literals are E'' with \n escapes rather than multi-line dollar quotes: with
-- core.autocrlf a Windows checkout would put \r\n in them and nothing would match.
-- Each update is guarded and idempotent; the final block warns if live content had
-- drifted from blog-data.ts and a rate survived.

update blog_posts
set content = replace(content,
  E'Since we run one of these tools, here is our own arithmetic rather than a range. Creator AI bills dubbing at 3 credits per second, so 180 credits per source minute, which works out to **$1.44 per minute on Creator monthly and $0.88 per minute on Pro annual**. The free Starter plan includes 500 credits, which is 2 minutes 46 seconds of dubbing, enough to hear your own cloned voice in another language before paying anything.\n',
  E'Since we run one of these tools, here is how ours is billed. Creator AI charges dubbing per second of source audio, from the same credit pool that pays for scripts, thumbnails and subtitles, so there is no separate dubbing subscription to stack on top. The free Starter plan includes enough credits to dub a short clip and hear your own cloned voice in another language before paying anything. Current rates are on the [pricing page](/pricing).\n'),
    updated_at = now()
where slug = 'best-ai-dubbing-tool-for-youtubers-2026-compared'
  and strpos(content, E'Since we run one of these tools, here is our own arithmetic rather than a range. Creator AI bills dubbing at 3 credits per second, so 180 credits per source minute, which works out to **$1.44 per minute on Creator monthly and $0.88 per minute on Pro annual**. The free Starter plan includes 500 credits, which is 2 minutes 46 seconds of dubbing, enough to hear your own cloned voice in another language before paying anything.\n') > 0;

update blog_posts
set content = replace(content,
  E'| Plan | AI dubbing cost per minute | Dubbing minutes/month |\n|------|---------------------------|-----------------------|\n| Starter (free) | $0 until credits run out | 2 min 46 s |\n| Creator, $24/mo | $1.44 | 16 min 40 s |\n| Pro, $49/mo | $1.10 | 44 min 26 s |\n| Pro, annual $39/mo | $0.88 | 44 min 26 s |\n\nThe full per-plan breakdown, the industry\'s underlying API floor, and how that compares to HeyGen, Rask and ElevenLabs is in our [AI dubbing cost teardown](/blog/how-much-does-ai-dubbing-cost-vs-traditional-dubbing-2026).\n',
  E'The industry\'s underlying API floor, and how HeyGen, Rask and ElevenLabs compare on price, is in our [AI dubbing cost teardown](/blog/how-much-does-ai-dubbing-cost-vs-traditional-dubbing-2026).\n'),
    updated_at = now()
where slug = 'best-ai-dubbing-tool-for-youtubers-2026-compared'
  and strpos(content, E'| Plan | AI dubbing cost per minute | Dubbing minutes/month |\n|------|---------------------------|-----------------------|\n| Starter (free) | $0 until credits run out | 2 min 46 s |\n| Creator, $24/mo | $1.44 | 16 min 40 s |\n| Pro, $49/mo | $1.10 | 44 min 26 s |\n| Pro, annual $39/mo | $0.88 | 44 min 26 s |\n\nThe full per-plan breakdown, the industry\'s underlying API floor, and how that compares to HeyGen, Rask and ElevenLabs is in our [AI dubbing cost teardown](/blog/how-much-does-ai-dubbing-cost-vs-traditional-dubbing-2026).\n') > 0;

update blog_posts
set content = replace(content,
  E'**Pricing:** dubbing is billed per second of source audio from your shared credit pool, at 15 credits per second, which is 900 credits a finished minute. There is no separate dubbing subscription. See [current plans](/pricing).\n',
  E'**Pricing:** dubbing is billed per second of source audio from your shared credit pool. There is no separate dubbing subscription. See [current plans](/pricing).\n'),
    updated_at = now()
where slug = 'how-much-does-ai-dubbing-cost-vs-traditional-dubbing-2026'
  and strpos(content, E'**Pricing:** dubbing is billed per second of source audio from your shared credit pool, at 15 credits per second, which is 900 credits a finished minute. There is no separate dubbing subscription. See [current plans](/pricing).\n') > 0;

update blog_posts
set content = replace(content,
  E'**Effective rate:** roughly 7 USD per minute on the entry Creator plan, falling to under 4 USD per minute on higher tiers, from the same credits that also buy scripts, thumbnails, story structure and subtitles.\n',
  E'**Effective rate:** set by what a credit costs on your plan, and the same credits also buy scripts, thumbnails, story structure and subtitles.\n'),
    updated_at = now()
where slug = 'how-much-does-ai-dubbing-cost-vs-traditional-dubbing-2026'
  and strpos(content, E'**Effective rate:** roughly 7 USD per minute on the entry Creator plan, falling to under 4 USD per minute on higher tiers, from the same credits that also buy scripts, thumbnails, story structure and subtitles.\n') > 0;

update blog_posts
set content = replace(content,
  E'| 4 | Creator AI | Free credits, then usage | 0.88 to 1.44 USD | Shared credit pool | No | One workflow, script to dub |\n',
  E'| 4 | Creator AI | Free credits, then usage | See current plans | Shared credit pool | No | One workflow, script to dub |\n'),
    updated_at = now()
where slug = 'how-much-does-ai-dubbing-cost-vs-traditional-dubbing-2026'
  and strpos(content, E'| 4 | Creator AI | Free credits, then usage | 0.88 to 1.44 USD | Shared credit pool | No | One workflow, script to dub |\n') > 0;

update blog_posts
set content = replace(content,
  E'## Our Own Numbers: What a Minute of Dubbing Actually Costs on Creator AI\n\nEvery roundup you will read, including the table above, quotes vendors\' marketing pages. We can do something no competitor writing about our pricing can: publish the arithmetic from the inside.\n',
  E'## How Creator AI Bills Dubbing\n'),
    updated_at = now()
where slug = 'how-much-does-ai-dubbing-cost-vs-traditional-dubbing-2026'
  and strpos(content, E'## Our Own Numbers: What a Minute of Dubbing Actually Costs on Creator AI\n\nEvery roundup you will read, including the table above, quotes vendors\' marketing pages. We can do something no competitor writing about our pricing can: publish the arithmetic from the inside.\n') > 0;

update blog_posts
set content = replace(content,
  E'Creator AI charges dubbing by duration, at **3 credits per second of source audio**, which is **180 credits per minute**. Credits are one shared pool across scripts, thumbnails, subtitles and dubbing, so the real per-minute price depends only on what a credit costs on your plan.\n',
  E'Every roundup you will read, including the table above, quotes vendors\' marketing pages. Here is how our own billing works from the inside.\n'),
    updated_at = now()
where slug = 'how-much-does-ai-dubbing-cost-vs-traditional-dubbing-2026'
  and strpos(content, E'Creator AI charges dubbing by duration, at **3 credits per second of source audio**, which is **180 credits per minute**. Credits are one shared pool across scripts, thumbnails, subtitles and dubbing, so the real per-minute price depends only on what a credit costs on your plan.\n') > 0;

update blog_posts
set content = replace(content,
  E'| Plan | Price | Monthly credits | Cost per credit | **AI dubbing cost per minute** | Dubbing minutes included |\n|------|-------|-----------------|-----------------|-------------------------------|--------------------------|\n| Starter | Free | 500 | n/a | Free until credits run out | 2 min 46 s |\n| Creator | $24/mo | 3,000 | $0.0080 | **$1.44** | 16 min 40 s |\n| Creator, annual | $19/mo | 3,000 | $0.0063 | **$1.14** | 16 min 40 s |\n| Pro | $49/mo | 8,000 | $0.0061 | **$1.10** | 44 min 26 s |\n| Pro, annual | $39/mo | 8,000 | $0.0049 | **$0.88** | 44 min 26 s |\n| Business | $299/mo | 50,000 | $0.0060 | **$1.08** | 4 h 37 min |\n| Scale | $599/mo | 100,000 | $0.0060 | **$1.08** | 9 h 15 min |\n',
  E'Creator AI charges dubbing by duration, per second of source audio. Credits are one shared pool across scripts, thumbnails, subtitles and dubbing, so what a dubbed minute costs you depends on two numbers: the dubbing rate and what a credit costs on your plan. Both live on our [pricing page](/pricing), the one place we quote them, so they are never out of date.\n'),
    updated_at = now()
where slug = 'how-much-does-ai-dubbing-cost-vs-traditional-dubbing-2026'
  and strpos(content, E'| Plan | Price | Monthly credits | Cost per credit | **AI dubbing cost per minute** | Dubbing minutes included |\n|------|-------|-----------------|-----------------|-------------------------------|--------------------------|\n| Starter | Free | 500 | n/a | Free until credits run out | 2 min 46 s |\n| Creator | $24/mo | 3,000 | $0.0080 | **$1.44** | 16 min 40 s |\n| Creator, annual | $19/mo | 3,000 | $0.0063 | **$1.14** | 16 min 40 s |\n| Pro | $49/mo | 8,000 | $0.0061 | **$1.10** | 44 min 26 s |\n| Pro, annual | $39/mo | 8,000 | $0.0049 | **$0.88** | 44 min 26 s |\n| Business | $299/mo | 50,000 | $0.0060 | **$1.08** | 4 h 37 min |\n| Scale | $599/mo | 100,000 | $0.0060 | **$1.08** | 9 h 15 min |\n') > 0;

update blog_posts
set content = replace(content,
  E'Three things fall out of that table that the marketing pages never say out loud.\n',
  E'Three things hold whatever the rate, and the marketing pages rarely say them out loud.\n'),
    updated_at = now()
where slug = 'how-much-does-ai-dubbing-cost-vs-traditional-dubbing-2026'
  and strpos(content, E'Three things fall out of that table that the marketing pages never say out loud.\n') > 0;

update blog_posts
set content = replace(content,
  E'**The free tier is a real test, not a teaser.** 500 credits is two minutes and 46 seconds of dubbing, enough to dub a full Short or the first two minutes of a long-form video and actually hear your cloned voice in Spanish before spending anything.\n',
  E'**The free tier is a real test, not a teaser.** Starter includes enough credits to dub a short clip and actually hear your cloned voice in Spanish before spending anything.\n'),
    updated_at = now()
where slug = 'how-much-does-ai-dubbing-cost-vs-traditional-dubbing-2026'
  and strpos(content, E'**The free tier is a real test, not a teaser.** 500 credits is two minutes and 46 seconds of dubbing, enough to dub a full Short or the first two minutes of a long-form video and actually hear your cloned voice in Spanish before spending anything.\n') > 0;

update blog_posts
set content = replace(content,
  E'**Annual billing is a bigger lever than the plan tier.** Pro annual is 39% cheaper per dubbed minute than Creator monthly. If dubbing is the reason you are subscribing, that single toggle matters more than which plan you pick.\n',
  E'**Annual billing lowers the cost of every dubbed minute.** Annual plans price each credit lower than monthly, and dubbing is billed in credits, so the saving carries straight through. If dubbing is the reason you are subscribing, check that toggle before comparing tiers.\n'),
    updated_at = now()
where slug = 'how-much-does-ai-dubbing-cost-vs-traditional-dubbing-2026'
  and strpos(content, E'**Annual billing is a bigger lever than the plan tier.** Pro annual is 39% cheaper per dubbed minute than Creator monthly. If dubbing is the reason you are subscribing, that single toggle matters more than which plan you pick.\n') > 0;

do $$
begin
  if exists (
    select 1 from blog_posts
    where slug in ('best-ai-dubbing-tool-for-youtubers-2026-compared',
                   'how-much-does-ai-dubbing-cost-vs-traditional-dubbing-2026')
      and (strpos(content, 'credits per second') > 0 or strpos(content, 'Dubbing minutes') > 0)
  ) then
    raise warning 'A dubbing blog post still quotes a dubbing rate; its live content differs from blog-data.ts, fix it in the admin editor.';
  end if;
end $$;

import { durationFor, timingCoverage, summarise, median } from './timing.js';
let p=0,f=0; const eq=(n,a,b)=>{const ok=JSON.stringify(a)===JSON.stringify(b);ok?p++:f++;console.log((ok?'PASS  ':'FAIL  ')+n+(ok?'':` got ${JSON.stringify(a)} want ${JSON.stringify(b)}`));};

const T=(o)=>({status:'completed',called_at:'2026-10-20T10:00:00Z',completed_at:'2026-10-20T10:20:00Z',...o});

eq('normal visit counts', durationFor(T({})).minutes, 20);
eq('system-closed excluded', durationFor(T({expired_at:'2026-10-20T10:30:00Z'})).reason, 'system_closed');
eq('closed_by system excluded', durationFor(T({closed_by:'system'})).reason, 'system_closed');
eq('not completed excluded', durationFor(T({status:'no_show'})).reason, 'not_completed');
eq('missing timestamps', durationFor(T({completed_at:null})).reason, 'missing_timestamps');
eq('5-hour visit implausible', durationFor(T({completed_at:'2026-10-20T15:30:00Z'})).reason, 'implausible');
eq('negative/clock skew excluded', durationFor(T({completed_at:'2026-10-20T09:00:00Z'})).reason, 'missing_timestamps');
eq('started_at preferred over called_at', durationFor(T({started_at:'2026-10-20T10:05:00Z'})).minutes, 15);

const set=[
  T({}), T({}), T({}),
  T({expired_at:'x'}), T({expired_at:'x'}),
  {status:'waiting'},
  {status:'no_show', closed_by:'staff'},
  T({completed_at:null}),
];
const c=timingCoverage(set);
eq('completed count excludes swept', c.completed, 4);
eq('timed count', c.timed, 3);
eq('coverage 3/4', Math.round(c.timingCoverage*100), 75);
eq('system closed counted', c.systemClosed, 2);
eq('still open counted', c.stillOpen, 1);
eq('exclusion reason recorded', c.excluded.missing_timestamps, 1);
eq('known outcome excludes cron but keeps timestamp-less completions', c.knownOutcome, 5);

eq('no data -> null not zero', timingCoverage([]).timingCoverage, null);
eq('below minSample -> no median', summarise([T({})],{minSample:5}).median, null);
eq('median not mean', median([1,2,3,100]), 2.5);

console.log(`\n${p} passed, ${f} failed`); process.exit(f?1:0);

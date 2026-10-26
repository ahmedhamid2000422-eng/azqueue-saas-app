import {
  hourlyCapacity, hourOutlook, dayOutlook, staffNeeded,
  dropOffScenario, describeBacklog, suggestions, DEFAULT_TARGETS,
} from './capacity.js';

let p=0,f=0; const eq=(n,a,b)=>{const ok=JSON.stringify(a)===JSON.stringify(b);ok?p++:f++;
  console.log((ok?'PASS  ':'FAIL  ')+n+(ok?'':` got ${JSON.stringify(a)} want ${JSON.stringify(b)}`));};

// Observed: Monday arrivals per day, Oct 2026, America/Denver, n=4 Mondays
const monday=[{hour:9,arrivals:3.8},{hour:10,arrivals:6.5},{hour:11,arrivals:3.3},
              {hour:12,arrivals:4.0},{hour:13,arrivals:1.5},{hour:14,arrivals:0.8},
              {hour:15,arrivals:2.3},{hour:16,arrivals:1.5}];

eq('capacity arithmetic', hourlyCapacity({staffCount:2,serviceMinutes:20}), 6);
eq('missing input -> null', hourlyCapacity({staffCount:2}), null);

const h=hourOutlook({arrivals:6.5,staffCount:2,serviceMinutes:20,carriedOver:3});
eq('hour marked predicted', h.basis, 'predicted');
eq('wait is an estimate, not measured', h.estimatedWaitMinutes, 30);

const d=dayOutlook({hours:monday,staffCount:2,serviceMinutes:40});
eq('assumptions are exposed', d.assumptions.serviceMinutes, 40);
eq('operating hours stated', d.assumptions.operatingHours, '9:00–17:00');
eq('peak hour reported', d.peakHour, 12);
eq('growth hour differs from peak hour', d.fastestGrowthHour !== d.peakHour, true);
eq('closing backlog reported separately', d.closingBacklog, 0);
eq('targets not met', d.meetsTargets, false);
eq('hours above wait target counted', d.hoursAboveWaitTarget > 0, true);

// A temporary queue within target is acceptable
const lenient=dayOutlook({hours:monday,staffCount:3,serviceMinutes:20,
  targets:{waitTargetMinutes:20,acceptablePeak:3,closingBacklogMax:0}});
eq('temporary queue can pass', lenient.meetsTargets, true);

const need=staffNeeded({hours:monday,serviceMinutes:40});
eq('staffing explains itself', need.becauseOf.busiestHour, 10);
eq('staffing cites peak not daily total', need.becauseOf.peakArrivalsThatHour, 6.5);

const dr=dropOffScenario({hours:monday,staffCount:2,serviceMinutes:40,share:0.3,intakeMinutes:5});
eq('drop-off owes back-office hours', dr.backOfficeHoursOwed > 0, true);
eq('back-office work is not removed', dr.assumptions.backOfficeMinutes, 40);
eq('counter peak improves', dr.counter.peakBacklog < d.peakBacklog, true);

eq('fractional backlog phrased as equivalent', describeBacklog(5.6), 'a backlog equivalent to about 6 customers');
eq('tiny backlog is not a queue', describeBacklog(0.3), 'no meaningful queue');

const s=suggestions({hours:monday,staffCount:2,serviceMinutes:40,dropOff:{share:0.3,intakeMinutes:5}});
eq('leads with assumptions', s[0].kind, 'assumptions');
eq('every line declares its basis', s.every(x=>x.basis==='assumed'||x.basis==='predicted'), true);
eq('never says understaffed', s.some(x=>/understaffed/i.test(x.text)), false);
eq('drop-off names the moved work', s.some(x=>/back-office/.test(x.text)), true);

console.log(`\n${p} passed, ${f} failed`);
console.log('\n--- Scenario output ---'); s.forEach(x=>console.log(`  [${x.basis}] ${x.text}`));
process.exit(f?1:0);

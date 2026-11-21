import assert from 'node:assert/strict';
import test from 'node:test';
import {evidenceFrames} from '../site/evidence-playback.mjs';
import {createReview} from '../site/trust.mjs';

const graph = [{id:'leaf'}, {id:'target', dependsOn:['leaf']}];
const evidence = (id,nodeId,outcome,group,at,supersedes) => createReview({id,nodeId,outcome,group,at,supersedes,source:'test fixture',note:'Test observation.'});

test('graph playback groups simultaneous checks and replays a later withdrawal', () => {
  const a = evidence('a','leaf','challenge','a','2026-11-20T18:00:00Z');
  const b = evidence('b','target','support','b','2026-11-20T13:00:00-05:00');
  const c = evidence('c','leaf','withdrawn','a','2026-11-21T12:42:00Z','a');
  const timeline = evidenceFrames(graph,[c,b,a]);
  assert.deepEqual(timeline.points,[{at:null,end:0},{at:a.at,end:2},{at:c.at,end:3}]);
  const start = timeline.frame(0);
  assert.deepEqual(start.records,[]);
  assert.equal(start.model.target.status,'unreviewed');
  const disputed = timeline.frame(1);
  assert.equal(disputed.records.length,2);
  assert.equal(disputed.model.target.status,'blocked');
  assert.equal(disputed.model.target.blockers[0].origin,'leaf');
  assert.equal(timeline.frame(2).model.target.status,'inconclusive');
  assert.equal(timeline.frame(1),disputed);
  assert.throws(()=>timeline.frame(99),RangeError);
});

test('an empty timeline contains one empty checkpoint', () => {
  const timeline=evidenceFrames(graph,[]);
  assert.deepEqual(timeline.points,[{at:null,end:0}]);
  assert.equal(timeline.frame(0).model.leaf.counts.total,0);
});

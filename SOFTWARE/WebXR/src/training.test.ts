import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Training } from './training.ts';

function prepared() {
  const training = new Training();
  assert.ok(training.act('lid'));
  assert.ok(training.act('sample'));
  assert.ok(training.act('start'));
  assert.ok(training.act('drop'));
  assert.ok(training.act('lid'));
  assert.ok(training.act('coat'));
  return training;
}

test('guided operation completes only after full coating, stopping and retrieval', () => {
  const t = prepared();
  assert.equal(t.phase, 'rampup');
  t.update(3);
  assert.equal(t.phase, 'coating');
  assert.equal(t.rpm, 3000);
  t.update(30);
  assert.equal(t.phase, 'rampdown');
  assert.equal(t.finished, false);
  t.update(1.5);
  assert.equal(t.phase, 'idle');
  assert.equal(t.rpm, 0);
  assert.equal(t.finished, true);
  assert.equal(t.complete, false);
  assert.ok(t.act('lid'));
  assert.ok(t.act('sample'));
  assert.equal(t.complete, true);
  assert.equal(t.step, 8);
});

test('invalid order and interaction while spinning do not mutate the operation', () => {
  const t = new Training();
  assert.equal(t.act('start'), false);
  assert.equal(t.act('sample'), false);
  t.act('lid'); t.act('sample'); t.act('start');
  assert.equal(t.act('coat'), false);
  assert.equal(t.act('sample'), false);
  assert.equal(t.act('rpmUp'), false);
  t.act('drop');
  assert.equal(t.act('coat'), false);
  t.act('lid'); t.act('coat');
  assert.equal(t.act('lid'), false);
  assert.equal(t.lidOpen, false);
  assert.equal(t.coatRPM, 3000);
});

test('STOP during each active phase ramps from current RPM and allows retry without completion', () => {
  for (const elapsed of [0, 1.5, 10]) {
    const t = prepared();
    t.update(elapsed);
    const rpm = t.rpm;
    assert.ok(t.act('stop'));
    t.update(0.75);
    assert.equal(t.rpm, rpm / 2);
    assert.equal(t.act('lid'), false);
    t.update(0.75);
    assert.equal(t.phase, 'idle');
    assert.equal(t.finished, false);
    assert.equal(t.dropped, false);
    t.act('lid'); t.act('start');
    assert.equal(t.phase, 'dispensing');
    assert.ok(t.act('drop'));
  }
  const t = new Training();
  t.act('lid'); t.act('sample'); t.act('start'); t.act('stop'); t.update(1.5);
  assert.equal(t.finished, false);
});

test('settings stay in firmware bounds and frame overflow preserves the state sequence', () => {
  const t = new Training();
  for (let i = 0; i < 100; i++) { t.act('rpmDown'); t.act('timeDown'); }
  assert.equal(t.coatRPM, 300);
  assert.equal(t.coatSeconds, 1);
  for (let i = 0; i < 100; i++) { t.act('rpmUp'); t.act('timeUp'); }
  assert.equal(t.coatRPM, 8000);
  assert.equal(t.coatSeconds, 80);
  const long = prepared();
  long.update(100);
  assert.equal(long.phase, 'idle');
  assert.equal(long.finished, true);
  assert.equal(long.rpm, 0);
});

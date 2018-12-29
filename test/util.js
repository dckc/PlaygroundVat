export function makeTranscript() {
  const lines = [];
  const waiters = [];

  return {
    writeOutput(line) {
      lines.push(line);
      const w = waiters.shift();
      if (w) {
        w(line);
      }
    },

    lines,

    wait() {
      return new Promise(r => waiters.push(r));
    },
  };
}

export function funcToSource(f) {
  let code = `${f}`;
  code = code.replace(/^function .* {/, '');
  code = code.replace(/}$/, '');
  return code;
}

export function makeQueues(t) {
  const queues = new Map();

  function toKey(a, b) {
    return `${a}->${b}`;
  }

  function addQueue(a, b) {
    const key = toKey(a, b);
    const q = [];
    queues.set(key, q);
    const c = {
      send(msg) {
        console.log(`SEND ${key}`, msg);
        q.push(msg);
      },
    };
    return c;
  }

  function dump() {
    console.log('queues:');
    for (const k of queues.keys()) {
      console.log(k, queues.get(k));
    }
  }

  function expect(a, b, frame, msg) {
    const key = toKey(a, b);
    const q = queues.get(key);
    t.ok(q.length > 0);
    if (!q.length) throw new Error('ugh');
    // console.log('---');
    // console.log('expect', a, b, q);
    const got = q.shift();
    t.notEqual(got, undefined);
    // console.log('--got', got);
    t.ok(got.startsWith('op '), got);
    const payload = JSON.parse(got.slice(3));
    if (msg) {
      if (!payload.hasOwnProperty('opMsg')) {
        t.fail(`expected .opMsg but didn't find one in ${got}`);
        return undefined;
      }
      const gotMsg = payload.opMsg;
      delete payload.opMsg;
      if (gotMsg.argsS) {
        gotMsg.args = JSON.parse(gotMsg.argsS);
        delete gotMsg.argsS;
      }
      if (gotMsg.valueS) {
        gotMsg.value = JSON.parse(gotMsg.valueS);
        delete gotMsg.valueS;
      }
      t.deepEqual(gotMsg, msg);
    }
    t.deepEqual(payload, frame);
    return got;
  }

  function expectAndDeliverAck(a, b, targetVat, ackSeqnum) {
    // todo: acks are disabled until we figure out what they mean in a quorum vat
    return;
    const got = expect(a, b, { ackSeqnum, type: 'ack' }, undefined);
    targetVat.commsReceived(`vat${a}`, got);
  }

  function expectEmpty(a, b) {
    const key = toKey(a, b);
    const q = queues.get(key);
    t.equal(q.length, 0);
  }

  return {
    dump,
    addQueue,
    expect,
    expectAndDeliverAck,
    expectEmpty,
  };
}

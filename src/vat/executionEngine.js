// the execution engine
import { doSwissHashing } from './swissCrypto';
import { makeWebkeyMarshal } from './webkey';

export function makeEngine(
  def,
  hash58,
  Vow,
  isVow,
  Flow,
  makePresence,
  makeUnresolvedRemoteVow,
  handlerOf,
  resolutionOf,
  myVatID,
  myVatSecret,
  manager,
) {
  function allocateSwissStuff() {
    return marshal.allocateSwissStuff();
  }

  function registerRemoteVow(vatID, swissnum, resultVow) {
    marshal.registerRemoteVow(vatID, swissnum, resultVow);
  }

  // todo: queue this until finishTurn
  function opSend(
    resultSwissbase,
    targetVatID,
    targetSwissnum,
    methodName,
    args,
    resolutionOf,
  ) {
    const argsS = marshal.serialize(def(args), resolutionOf);
    const body = def({
      op: 'send',
      targetSwissnum,
      methodName,
      argsS,
      resultSwissbase,
    });
    manager.sendTo(targetVatID, body);
  }

  function opWhen(targetVatID, targetSwissnum) {
    const body = def({
      op: 'when',
      targetSwissnum,
    });
    manager.sendTo(targetVatID, body);
  }

  const serializer = {
    opSend,
    opWhen,
    allocateSwissStuff,
    registerRemoteVow,
  };
  const marshal = makeWebkeyMarshal(
    log,
    hash58,
    Vow,
    isVow,
    Flow,
    makePresence,
    makeUnresolvedRemoteVow,
    myVatID,
    myVatSecret,
    serializer,
  );
  // marshal.serialize, unserialize, serializeToWebkey, unserializeWebkey

  // temporary, for tests
  const ext = Vow.resolve(makePresence(serializer, 'v2', 'swiss1'));

  function opResolve(targetVatID, targetSwissnum, value) {
    // todo: rename targetSwissnum to mySwissnum? The thing being resolved
    // lives on the sender, not the recipient.
    const valueS = marshal.serialize(def(value), resolutionOf);
    const body = def({
      op: 'resolve',
      targetSwissnum,
      valueS,
    });
    manager.sendTo(targetVatID, body);
  }

  function rxSendOnly(opMsg) {
    // currently just for tests
    return doSendInternal(opMsg);
  }

  function doSendInternal(opMsg) {
    const target = marshal.getMyTargetBySwissnum(opMsg.targetSwissnum);
    if (!target) {
      throw new Error(`unrecognized target, swissnum=${opMsg.targetSwissnum}`);
    }
    if (!opMsg.argsS) {
      throw new Error('opMsg is missing .argsS');
    }
    const args = marshal.unserialize(opMsg.argsS);
    // todo: sometimes causes turn delay, could fastpath if target is
    // resolved
    return Vow.resolve(target).e[opMsg.methodName](...args);
  }

  function rxMessage(senderVatID, opMsg) {
    // opMsg is { op: 'send', targetSwissnum, methodName, argsS,
    // resultSwissbase, answerR }, or { op: 'resolve', targetSwissnum, valueS
    // } . Pass argsS/valueS to marshal.unserialize

    // We are strictly given messages in-order from each sender

    // todo: It does not include seqnum (which must be visible to the manager).
    // sent messages are assigned a seqnum by the manager
    // txMessage(recipientVatID, message)

    // log(`op ${opMsg.op}`);
    let done;
    if (opMsg.op === 'send') {
      const res = doSendInternal(opMsg);
      if (opMsg.resultSwissbase) {
        const resolverSwissnum = doSwissHashing(opMsg.resultSwissbase, hash58);
        // if they care about the result, they'll send an opWhen hot on the
        // heels of this opSend, which will register their interest in the
        // Vow
        marshal.registerTarget(res, resolverSwissnum, resolutionOf);
        // note: BrokenVow is pass-by-copy, so Vow.resolve(rej) causes a BrokenVow
      } else {
        // else it was really a sendOnly
        log('commsReceived got sendOnly, dropping result');
      }
      done = res; // for testing
    } else if (opMsg.op === 'when') {
      const v = marshal.getMyTargetBySwissnum(opMsg.targetSwissnum);
      // todo: assert that it's a Vow, but really we should tolerate peer
      // being weird
      Vow.resolve(v).then(res =>
        opResolve(senderVatID, opMsg.targetSwissnum, res),
      );
      // todo: rejection
    } else if (opMsg.op === 'resolve') {
      // log('-- got op resolve');
      // log(' senderVatID', senderVatID);
      // log(' valueS', opMsg.valueS);
      const h = marshal.getOutboundResolver(
        senderVatID,
        opMsg.targetSwissnum,
        handlerOf,
      );
      // log(`h: ${h}`);
      // log('found target');
      let value;
      try {
        value = marshal.unserialize(opMsg.valueS);
      } catch (ex) {
        log('exception in unserialize of:', opMsg.valueS);
        log(ex);
        throw ex;
      }
      // log('found value', value);
      h.resolve(value);
      // log('did h.resolve');
    }
    return done; // for testing, to wait until things are done
  }

  const engine = {
    rxMessage,
    rxSendOnly,
    createPresence(sturdyref) {
      return marshal.createPresence(sturdyref);
    },
    registerTarget(target, swissnum) {
      marshal.registerTarget(target, swissnum, resolutionOf);
    },
    // temporary
    marshal,
    serializer,
    ext,
    // tests
    serialize(val) {
      return marshal.serialize(val, resolutionOf);
    },
  };

  return def(engine);
}

/* global Vow Flow def */
// Copyright (C) 2013 Google Inc.
// Copyright (C) 2018 Agoric
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

export default function (argv) {
  const escrowSrc = argv.escrowSrc;
  const contractHostP = Vow.resolve(argv.host);
  const bobP = Vow.resolve(argv.bob);

  const f = new Flow();

  let initialized = false;
  let myMoneyPurseP;
  let myMoneyIssuerP;
  let myStockPurseP;
  let myStockIssuerP;

  function init(myMoneyPurse, myStockPurse) {
    initialized = true;
    myMoneyPurseP = Vow.resolve(myMoneyPurse);
    myMoneyIssuerP = myMoneyPurseP.e.getIssuer();
    myStockPurseP = Vow.resolve(myStockPurse);
    myStockIssuerP = myStockPurseP.e.getIssuer();
    return alice;
  }

  const check = function (allegedSrc, allegedSide) {
    // for testing purposes, alice and bob are willing to play
    // any side of any contract, so that the failure we're testing
    // is in the contractHost's checking
  };

  const alice = def({
    init,
    payBobWell() {
      if (!initialized) {
        log('++ ERR: payBobWell called before init()');
      }
      const paymentP = myMoneyIssuerP.e.makeEmptyPurse();
      const ackP = paymentP.e.deposit(10, myMoneyPurseP);
      return ackP.then(_ => bobP.e.buy('shoe', paymentP));
    },
    payBobBadly1() {
      if (!initialized) {
        log('++ ERR: payBobBadly1 called before init()');
      }
      const payment = def({ deposit(amount, src) {} });
      return bobP.e.buy('shoe', payment);
    },
    payBobBadly2() {
      if (!initialized) {
        log('++ ERR: payBobBadly2 called before init()');
      }
      const paymentP = myMoneyIssuerP.e.makeEmptyPurse();
      const ackP = paymentP.e.deposit(5, myMoneyPurseP);
      return ackP.then(_ => bobP.e.buy('shoe', paymentP));
    },

    tradeWell() {
      if (!initialized) {
        log('++ ERR: tradeWell called before init()');
      }
      const tokensP = contractHostP.e.setup(escrowSrc);
      const aliceTokenP = tokensP.then(tokens => tokens[0]);
      const bobTokenP = tokensP.then(tokens => tokens[1]);
      Vow.resolve(bobP).e.invite(bobTokenP, escrowSrc, 1);
      return Vow.resolve(alice).e.invite(aliceTokenP, escrowSrc, 0);
    },

    invite(tokenP, allegedSrc, allegedSide) {
      if (!initialized) {
        log('++ ERR: invite called before init()');
      }

      check(allegedSrc, allegedSide);

      let cancel;
      const a = def({
        moneySrcP: myMoneyIssuerP.e.makeEmptyPurse('aliceMoneySrc'),
        stockDstP: myStockIssuerP.e.makeEmptyPurse('aliceStockDst'),
        stockNeeded: 7,
        cancellationP: f.makeVow(r => {
          cancel = r;
        }),
      });
      const ackP = a.moneySrcP.e.deposit(10, myMoneyPurseP);

      const doneP = ackP.then(_ =>
        contractHostP.e.play(tokenP, allegedSrc, allegedSide, a),
      );
      return doneP.then(_ => a.stockDstP.e.getBalance());
    },
  });
  return alice;
}

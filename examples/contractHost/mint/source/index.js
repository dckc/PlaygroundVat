/* global log Vow Flow def Nat */
// Copyright (C) 2012 Google Inc.
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
  let debugCounter = 0;

  function makeMint() {
    // Map from purse or payment to balance
    const ledger = new WeakMap();

    const issuer = def({
      makeEmptyPurse(name) {
        return mint(0, name);
      },
    });

    const mint = function (initialBalance, name) {
      const purse = def({
        getBalance() {
          log('getBalance', ledger.get(purse));
          return ledger.get(purse);
        },
        getIssuer() {
          return issuer;
        },
        deposit(amount, srcP) {
          amount = Nat(amount);
          debugCounter += 1;
          const c = debugCounter;
          log(`deposit[${name}]#${c}: bal=${ledger.get(purse)} amt=${amount}`);
          return Vow.resolve(srcP).then(src => {
            log(
              ` dep[${name}]#${c} (post-P): bal=${ledger.get(
                purse,
              )} amt=${amount}`,
            );
            const myOldBal = Nat(ledger.get(purse));
            const srcOldBal = Nat(ledger.get(src));
            Nat(myOldBal + amount);
            const srcNewBal = Nat(srcOldBal - amount);
            // ///////////////// commit point //////////////////
            // All queries above passed with no side effects.
            // During side effects below, any early exits should be made into
            // fatal turn aborts.
            ledger.set(src, srcNewBal);
            // In case purse and src are the same, add to purse's updated
            // balance rather than myOldBal above. The current balance must be
            // >= 0 and <= myOldBal, so no additional Nat test is needed.
            // This is good because we're after the commit point, where no
            // non-fatal errors are allowed.
            ledger.set(purse, ledger.get(purse) + amount);
          });
        },
      });
      ledger.set(purse, initialBalance);
      return purse;
    };
    return def({ mint });
  }

  return { makeMint };
}

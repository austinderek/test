console.log("A");
debugger;
console.log("B");
debugger;
console.log("C");
debugger;
console.log("D");
debugger;
if (foo == null) {
  bar();
}

debugger;

console.log("E");

function footwo() {
  var bar;
  let baz;
}

let foo = function() {
  try {
    return 1;
  } catch (err) {
    return 2;
  } finally {
    return 3;
  }
};

try {
  doSomethingThatMightThrow();
} catch (e) {
  throw e;
}

try {
  doSomethingThatMightThrow();
} catch (e) {
  throw e;
} finally {
  cleanUp();
}

var roo = function rar() {};
roo = function rar() {};
obj.roo = function rar() {};
obj["roo"] = function rar() {};
var obj = { roo: function rar() {} };
({ ["roo"]: function rar() {} });

let newVar = Array(0, 1, 2);

var Class = require('jsx').Class;Class('Parent1', {  _init: function Parent1() {    console.log('parent 1 cons');  }});Class('Parent2', {  _init: function Parent2() {    console.log('parent 2 cons');  }});Class('Parent3', {  _init: function Parent3() {    console.log('parent 3 cons');  }});Class('Child1', {  _extends: Parent1,  _init: function Child1() {    this._super();    console.log('child 1 cons');  }});Class('Child2', {  _extends: Parent2,  _init: function Child2() {    this._super();    console.log('child 2 cons');  }});var p1 = new Parent1();var p2 = new Parent2();var c1 = new Child1();var c2 = new Child2();var c1 = new Child1();Class('Child3', {  _extends: Parent3,});var c3 = new Child3();console.log(Child3);
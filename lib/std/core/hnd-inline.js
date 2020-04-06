/*---------------------------------------------------------------------------
  Copyright 2020 Microsoft Corporation.

  This is free software; you can redistribute it and/or modify it under the
  terms of the Apache License, Version 2.0. A copy of the License can be
  found in the file "license.txt" at the root of this distribution.
---------------------------------------------------------------------------*/

//var $std_core_hnd._evv_ofs = 0;
//var $std_core_hnd._evv     = [];
//var $std_core_hnd._yield   = null; // { marker: 0, clause: null, conts: [], conts_count: 0, final: bool };

var $marker_unique = 1;

function _assert(cond,msg) {
  if (!cond) console.error(msg);
}

$std_core_hnd = $std_core_types._export($std_core_hnd,{
                  "_evv_ofs": 0,
                  "_evv"    : [],
                  "_yield"  : null,
                });

//--------------------------------------------------
// evidence: { evv: [forall h. ev<h>], ofs : int }
//--------------------------------------------------

function _evv_insert(w,ev) {
  const ofs = w.ofs;
  const evv = w.evv;
  const n = evv.length - ofs;
  const evv2 = new Array(n+1);
  var i;
  for(i = 0; i < n; i++) {
    const ev2 = evv[i + ofs];
    if (ev._field1 <= ev2._field1) break;
    evv2[i] = ev2;
  }
  evv2[i] = ev;
  for(; i < n; i++) {
    evv2[i+1] = evv[i + ofs];
  }
  return { evv: evv2, ofs: 0 };
}

function _evv_delete(w,i) {
  const ofs = w.ofs;
  const evv = w.evv;
  const n = evv.length - ofs;
  const evv2 = new Array(n-1);
  var j;
  for(j = 0; j < i; j++) {
    evv2[j] = evv[j + ofs];
  }
  for(; j < n-1; j++) {
    evv2[j] = evv[j + ofs + 1];
  }
  return { evv: evv2, ofs: 0 };
}

function __evv_lookup(evv,ofs,tag) {
  for(var i = ofs; i < evv.length; i++) {
    if (tag === evv[i]._field1) return evv[i];
  }
  console.error("cannot find " + tag + " in " + _evv_show({evv:evv,ofs:ofs}));
  return null;
}

function __evv_index(evv,ofs,tag) {
  for(var i = ofs; i < evv.length; i++) {
    if (tag === evv[i]._field1) return (i - ofs);
  }
  console.error("cannot find " + tag + " in " + _evv_show({evv:evv,ofs:ofs}));
  return null;
}

function _evv_show(w) {
  const evv = w.evv.slice(w.ofs);
  evv.sort(function(ev1,ev2){ return (ev1._field2 - ev2._field2); });
  var out = "";
  for( var i = 0; i < evv.length; i++) {
    out += ("" + evv[i]._field1.padEnd(8," ") + ": marker " + evv[i]._field2 + ", under <" + evv[i]._field4.map(function(ev){ return ev._field2.toString(); }).join(",") + ">\n");
  }
  return out;
}

function _yield_show() {
  if (_yielding()) {
    return "yielding to " + $std_core_hnd._yield.marker + ", final: " + $std_core_hnd._yield.final;
  }
  else {
    return "pure"
  }
}


function _evv_expect(m,expected) {
  if (($std_core_hnd._yield===null || $std_core_hnd._yield.marker === m) && ($std_core_hnd._evv !== expected.evv || $std_core_hnd._evv_ofs !== expected.ofs)) {
    console.error("expected evidence: \n" + _evv_show(expected) + "\nbut found:\n" + _evv_show({ evv: $std_core_hnd._evv, ofs: $std_core_hnd._evv_ofs }));
  }
}

function _guard(w) {
  if (!($std_core_hnd._evv === w.evv && $std_core_hnd._evv_ofs === w.ofs)) {
    console.error("trying to resume outside the (handler) scope of the original handler. \n captured under:\n" + _evv_show(w) + "\n but resumed under:\n" + _evv_show({evv:$std_core_hnd._evv, ofs: $std_core_hnd._evv_ofs }));
    throw "trying to resume outside the (handler) scope of the original handler";
  }
}

function _throw_resume_final() {
  throw "trying to resume an unresumable resumption (from finalization)";
}

function _evv_create( w, indices ) {
  const ofs = w.ofs;
  const evv = w.evv;
  const n = indices.length;
  const evv2 = new Array(n);
  for(var i = 0; i < n; i++) {
    evv2[i] = evv[ofs + indices[i]];
  }
  return { evv: evv2, ofs: 0 };
}

//--------------------------------------------------
// Yielding
//--------------------------------------------------
function _yielding() {
  return ($std_core_hnd._yield !== null);
}

function _kcompose( from, to, conts ) {
  return function(x) {
    var acc = x;
    for(var i = from; i < to; i++) {
      acc = conts[i](acc);
      if (_yielding()) return ((function(i){ return _yield_extend(_kcompose(i+1,to,conts)); })(i));
    }
    return acc;
  }
}

function _yield_extend(next) {
  _assert(_yielding(), "yield extension while not yielding!");
  if ($std_core_hnd._yield.final) return;
  $std_core_hnd._yield.conts[$std_core_hnd._yield.conts_count++] = next;  // index is ~80% faster as push
}

function _yield_cont(f) {
  _assert(_yielding(), "yield extension while not yielding!");
  if ($std_core_hnd._yield.final) return;
  const cont   = _kcompose(0,$std_core_hnd._yield.conts_count,$std_core_hnd._yield.conts);
  $std_core_hnd._yield.conts = new Array(8);
  $std_core_hnd._yield.conts_count = 1;
  $std_core_hnd._yield.conts[0] = function(x){ return f(cont,x); };
}

function _yield_prompt(m) {
  if ($std_core_hnd._yield === null) {
    return Pure;
  }
  else if ($std_core_hnd._yield.marker !== m) {
    return ($std_core_hnd._yield.final ? YieldingFinal : Yielding);
  }
  else { // $std_core_hnd._yield.marker === m
    const cont   = ($std_core_hnd._yield.final ? $std_core_types.Nothing : $std_core_types.Just(_kcompose(0,$std_core_hnd._yield.conts_count,$std_core_hnd._yield.conts)));
    const clause = $std_core_hnd._yield.clause;
    $std_core_hnd._yield = null;
    return Yield(clause,cont);
  }
}

function _yield_final(m,clause) {
  _assert(!_yielding(),"yielding while yielding!");
  $std_core_hnd._yield = { marker: m, clause: clause, conts: null, conts_count: 0, final: true };
}


function _yield_to(m,clause) {
  _assert(!_yielding(),"yielding while yielding!");
  $std_core_hnd._yield = { marker: m, clause: clause, conts: new Array(8), conts_count: 0, final: false };
}
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThinkingOrb, type OrbState } from 'thinking-orbs';
const states: OrbState[] = ['listening', 'composing', 'solving'];
createRoot(document.getElementById('root')!).render(React.createElement('main', {style:{padding:48}},
 React.createElement('h1', null, 'Syka · comparación de orbes'),
 React.createElement('div', {style:{display:'flex',gap:32}}, ...states.map(state => React.createElement('section', {key:state,style:{padding:32,border:'1px solid #2a2a30',borderRadius:20,minWidth:200}},
  React.createElement('h2',null,state),React.createElement(ThinkingOrb,{state,size:64,theme:'dark'}),
  React.createElement('div',{style:{marginTop:32,display:'flex',gap:16,alignItems:'center'}},React.createElement(ThinkingOrb,{state,size:20,theme:'dark'}),'Syka Clips'))))));

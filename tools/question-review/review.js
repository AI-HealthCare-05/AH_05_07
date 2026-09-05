'use strict';
// Select existing text fixtures; never derive a source code from a response.
const byId = (id) => document.getElementById(id);
const setText = (id, text) => { byId(id).textContent = text; };
function selectCase(selected) {
  for (const button of byId('cases').children) {
    button.setAttribute('aria-pressed', String(button.dataset.case === selected.id));
  }
  setText('case-detail', selected.detail);
  setText('code', selected.result);
  setText('reason', selected.reason);
}
function selectFeature(feature) {
  for (const button of byId('features').children) {
    button.setAttribute('aria-pressed', String(button.dataset.feature === feature.id));
  }
  setText('feature-id', feature.id + ' / 한국어 질문 초안');
  for (const [id, field] of [['question', 'title'], ['draft', 'question'], ['options', 'options'], ['meaning', 'meaning'], ['coding', 'coding'], ['gap', 'gap']]) {
    setText(id, feature[field]);
  }
  byId('cases').replaceChildren(...feature.cases.map((example) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = example.title;
    button.dataset.case = example.id;
    button.addEventListener('click', () => selectCase(example));
    return button;
  }));
  byId('sources').replaceChildren(...feature.sources.map(([title, url]) => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = title;
    const address = document.createElement('span');
    address.className = 'source-url';
    address.textContent = url;
    link.append(address);
    item.append(link);
    return item;
  }));
  selectCase(feature.cases[0]);
}
for (const feature of window.REVIEW) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.feature = feature.id;
  const code = document.createElement('small');
  code.textContent = feature.id;
  button.append(code, feature.title);
  button.addEventListener('click', () => selectFeature(feature));
  byId('features').append(button);
}
selectFeature(window.REVIEW[0]);

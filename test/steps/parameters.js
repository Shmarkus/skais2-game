import { defineParameterType } from '@cucumber/cucumber';

defineParameterType({
  name: 'list',
  regexp: /\[.*?\]|[\w, ]+/,
  transformer: (s) => s,
});

defineParameterType({
  name: 'nth',
  regexp: /\d+(?:st|nd|rd|th)/,
  transformer: (s) => parseInt(s, 10),
});

defineParameterType({
  name: 'r',
  regexp: /be immune|not be immune|survive|die/,
  transformer: (s) => s,
});

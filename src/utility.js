const formatStrArgs = (str, args) => {
  return str.replace(/{(\d+)}/g, (match, number) => {
    if (typeof args[number] != 'undefined') {
      return args[number];
    }
    return match;
  });
};

const formatStr = (str, ...args) => {
  return formatStrArgs(str, args);
};

const max = (a, b) => (a > b ? a : b);

const max0 = (a) => max(a, 0);

export {formatStr, formatStrArgs, max, max0};

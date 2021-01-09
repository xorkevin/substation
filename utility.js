const formatURLArgs = (str, args) => {
  return str.replace(/{(\d+)}/g, (match, number) => {
    if (typeof args[number] != 'undefined') {
      return encodeURIComponent(args[number]);
    }
    return match;
  });
};

const formatURL = (str, ...args) => {
  return formatURLArgs(str, args);
};

export {formatURL, formatURLArgs};

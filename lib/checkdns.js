const dns = require('dns');
const fs = require('fs');
const chalk = require('chalk');
const { table, getBorderCharacters, createStream } = require('table');

const rtypeValid = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'PTR', 'ANY'];

const displayError = function (Err) {
  console.log(chalk.red(Err));
};

const parseFile = function (file, callback) {
  fs.readFile(file, function (err, data) {
    if (err) {
      displayError(err);
      return;
    }

    const domains = data.toString().split(/\n|;/);
    callback(domains);
  });
};

const isIPAddress = function (address) {
  const r = '^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9]).){3}(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])$';

  const ipRE = new RegExp(r);

  return ipRE.test(address);
};

const isValidType = function (type) {
  if (rtypeValid.indexOf(type) < 0) {
    return false;
  }
  return true;
};

const print = function (data, border) {
  if (!data.length) {
    return;
  }
  const options = {};
  if (!border) {
    options.border = getBorderCharacters('void');
  }
  console.log(
    table(data, options)
  );
};

/*
  Export
*/

const nslookup = function (domain, rtype, options, cb) {
  options = {...{chalk: true}, ...options};

  rtype = rtype || 'A';
  const isIP = isIPAddress(domain);

  if (!isValidType(rtype)) {
    displayError('Error: Type not vaild.');
    return;
  }

  if (isIP) {
    rtype = 'PTR';
  } else if (rtype === 'PTR') {
    rtype = 'A';
  }

  dns.resolve(domain, rtype, function (err, addresses) {
    if (err) {
      if (err.errno === 'ENODATA' && rtype === 'ANY') {
        return nslookup(domain, 'A', cb);
      }
      const rowError = [[options.chalk ? chalk.red(domain) : domain, rtype, options.chalk ? chalk.red(err.errno) : err.errno]];
      if (typeof cb === 'function') {
        cb(rowError);
      } else {
        print(rowError, !!cb);
      }
      return;
    }
    const rows = [];
    switch (rtype) {
    case 'PTR':
      rows.push([
        options.chalk ? chalk.blue(domain) : domain,
        rtype,
        options.chalk ? chalk.green(addresses) : addresses
      ]);
      break;
    case 'MX':
      addresses.forEach(function (iSrv, i) {
        rows.push([
          i === 0 ? [chalk.green(domain)] : [],
          rtype,
          options.chalk ? chalk.yellow(iSrv.priority) : iSrv.priority,
          options.chalk ? chalk.blue(iSrv.exchange) : iSrv.exchange
        ]);
      });
      break;
    case 'ANY':
      addresses.forEach(function (item, i) {
        if (!isValidType(item.type)) {
          return;
        }

        let value = '-';
        if (item.type === 'A' || item.type === 'AAAA') {
          value = item.address;
        } else if (item.type === 'MX') {
          value = item.exchange;
        } else if (item.type === 'NS' || item.type === 'CNAME') {
          value = item.value;
        } else if (item.type === 'TXT') {
          value = item.entries.join();
        }

        rows.push([
          i === 0 ? [options.chalk ? chalk.green(domain) : domain] : [],
          item.type,
          options.chalk ? chalk.blue(value) : value
        ]);
      });
      break;
    default:
      rows.push([
        options.chalk ? chalk.green(domain) : domain,
        rtype,
        options.chalk ? chalk.blue(addresses) : addresses
      ]);
    }

    if (typeof cb === 'function') {
      return cb(rows);
    }

    print(rows, !!cb);
  });
};

const nslookupFromFile = function (file, rtype, outputTable) {
  rtype = rtype || 'A';

  if (!isValidType(rtype)) {
    displayError('Error: Type not vaild.');
    return;
  }

  // Check if the file exists in the current directory.
  fs.access(file, fs.constants.F_OK, function (err) {
    if (err) {
      displayError('Error: File does not exists. (' + file + ')');
      return;
    }

    parseFile(file, function (domains) {
      const stream = createStream({
        columnDefault: {
          width: 30
        },
        columns: {
          1: {
            width: 5
          },
          2: {
            width: 50
          }
        },
        columnCount: 3
      });
      domains.forEach(function (domain) {
        if (domain.length) {
          nslookup(domain, rtype, outputTable ? function (rows) {
            rows.forEach(function (row) {
              stream.write(row);
            });
          } : null);
        }
      });
    });
  });
};

module.exports = {
  nslookup: nslookup,
  nslookupFromFile: nslookupFromFile
};

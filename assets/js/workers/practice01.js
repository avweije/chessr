var ecoData = [];

self.onmessage = function (msg) {
  switch (msg.data[0]) {
    case "setData":
      ecoData = msg.data[1];
      break;
    case "getEco":
      getEco(msg.data[1], msg.data[2]);
      break;
  }
};

function getEco(pgn, forTag = "") {
  // filter the ECO's by the current PGN
  var res = ecoData.filter((rec) => pgn.indexOf(rec.PGN) == 0);

  res.sort((a, b) => {
    if (a.PGN === b.PGN) return 0;
    return a.PGN > b.PGN ? -1 : 1;
  });

  // update the ECO field
  self.postMessage(["getEco", res[0], pgn, forTag]);
}

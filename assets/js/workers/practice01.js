var ecoData = [];

self.onmessage = function (msg) {
  console.log("message from main received in worker:", msg);

  switch (msg.data[0]) {
    case "setData":
      ecoData = msg.data[1];
      break;
    case "getEco":
      getEco(msg.data[1]);
      break;
  }

  // send buf back to main and transfer the underlying ArrayBuffer
  //self.postMessage(bufTransferredFromMain, [bufTransferredFromMain]);
};

function getEco(pgn) {
  // filter the ECO's by the current PGN
  var res = ecoData.filter((rec) => pgn.indexOf(rec.PGN) == 0);

  res.sort((a, b) => {
    if (a.PGN === b.PGN) return 0;
    return a.PGN > b.PGN ? -1 : 1;
  });

  console.log("filtered:", pgn);
  console.log("pgn: " + pgn);
  console.log(res);

  // update the ECO field
  self.postMessage(["getEco", res[0]]);

  //this.practiceInfoFields.children[1].innerHTML = res[0].Code + ", " + res[0].Name;
}

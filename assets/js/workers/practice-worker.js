var ecoData = [];

self.onmessage = function (msg) {
  switch (msg.data.action) {
    case 'SET_DATA':
      ecoData = msg.data.data;
      break;
    case 'GET_ECO':
      getEco(msg.data.pgn, msg.data.id);
      break;
  }
};

function getEco(pgn, id = null) {
  // Filter the ECO's by PGN
  var found = ecoData.filter((rec) => pgn.indexOf(rec.PGN) == 0);

  found.sort((a, b) => {
    if (a.PGN === b.PGN) return 0;
    return a.PGN > b.PGN ? -1 : 1;
  });

  const result = { 
    id: id, 
    code: found[0].Code ?? '', 
    name: found[0].Name ?? '', 
    pgn: pgn
  };

  // Return the ECO code
  self.postMessage(result);
}

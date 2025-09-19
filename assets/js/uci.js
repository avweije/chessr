/**
 * Class to load & communicate with stockfish web assembly.
 */
export class UCI {
  // WebAssembly supported?
  wasmSupported = null;

  // stockfish engine
  stockfish = null;

  // the engine name, author and options - options will be an object all the option values, min & maxes
  name = null;
  author = null;
  options = {};

  // status
  isUCI = false;
  isCalculating = false;

  // the queue of functions to execute once a certain message is received (uciok, readyok)
  queue = [];
  // the queue time limit, item gets removed from queue after that amount of time
  queueTimeLimit = 10 * 1000; // 10 seconds

  // start the stockfish engine
  startEngine() {
    this.wasmSupported =
      typeof WebAssembly === "object" &&
      WebAssembly.validate(
        Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00)
      );

    this.stockfish = new Worker(
      this.wasmSupported
        ? "/stockfish/stockfish.wasm.js"
        : "/stockfish/stockfish.js"
    );

    // add the event listeners
    this.stockfish.addEventListener("message", this.onWorkerMessage.bind(this));
    this.stockfish.addEventListener("error", this.onWorkerError.bind(this));
  }

  // unload/stop the engine
  stopEngine() {
    console.info("Stopping the engine. Calculating = ", this.isCalculating);
    console.info(this);
    // send quit command
    this.postMessage("quit");
    // if stockfish was calculating
    if (this.isCalculating) {
      // wait for bestmove to come in before terminating
      this.onReceive("bestmove", this.terminateWorker.bind(this));
    } else {
      // terminate the worker
      this.terminateWorker();
    }
  }

  terminateWorker() {
    console.info("Terminating the worker.");

    this.stockfish.terminate();
    this.stockfish = null;
  }

  // set UCI mode on
  sendUCI() {
    // set UCI mode on
    this.postMessage("uci");
  }

  // execute a function once a certain message is received (with time limit)
  onReceive(msg, func, onceOnly = true, replace = false) {
    // If we need to replace the current receiver, if any
    if (replace) {
      // Find the current receiver
      const idx = this.queue.findIndex((q) => q.msg === msg);

      console.log('onReceive replace:', idx);

      // Remove the current receiver
      if (idx !== -1) this.queue.splice(idx, 1);
    }
    // Add receiver to the queue
    this.queue.push({
      msg: msg,
      func: func,
      time: Date.now(),
      keep: !onceOnly,
    });
  }

  // post a message to stockfish
  postMessage(msg) {
    console.info("POST MESSAGE: " + msg);

    // get the command
    var parts = msg.split(" ");

    // if this is the go command, set isCalculating boolean
    if (parts[0].trim() === "go") {
      this.isCalculating = true;
    }
    // post the message
    this.stockfish.postMessage(msg);
  }

  // handle the message from stockfish
  onWorkerMessage(event) {
    //console.info("onWorkerMessage", event.data);

    // get the type of message we've received
    var parts = event.data.split(" ");
    // handle the message
    switch (parts[0]) {
      case "id":
        switch (parts[1]) {
          case "name":
            this.name = parts.slice(2).join(" ");
            break;
          case "author":
            this.author = parts.slice(2).join(" ");
            break;
        }
        break;
      case "option":
        // get the values
        var typeIdx = parts.indexOf("type");
        var name = parts.slice(2, typeIdx).join("");
        var type = parts[typeIdx + 1];
        var value = typeIdx + 3 < parts.length ? parts[typeIdx + 3] : "";
        // store the option
        switch (type) {
          case "string":
          case "check":
            this.options[name] = { type: type, value: value === "true" };
            break;
          case "spin":
            this.options[name] = {
              type: type,
              value: parseInt(value),
              min: parseInt(parts[typeIdx + 5]),
              max: parseInt(parts[typeIdx + 7]),
            };
            break;
          case "combo":
            this.options[name] = {
              type: type,
              value: value,
              vars: [],
            };
            for (var y = typeIdx + 5; y < parts.length; y = y + 2) {
              this.options[name].vars.push(parts[y]);
            }
            break;
          case "button":
            this.options[name] = { type: type };
            break;
        }
        break;
      case "uciok":
        this.isUCI = true;
        break;
      case "bestmove":
        this.isCalculating = false;
        break;
      case "info":
        break;
      default:
        // temp - debug info
        console.info(event.data);
        break;
    }

    // get current timestamp
    var now = Date.now();
    // check the queue
    var newQueue = [];
    for (var i = 0; i < this.queue.length; i++) {
      // if this is a once only item and the time limit has elapsed
      if (
        !this.queue[i].keep &&
        now - this.queue[i].time > this.queueTimeLimit
      ) {
        console.info("removing queue item due to time limit:");
        console.info(this.queue[i]);
      } else if (this.queue[i].msg == parts[0]) {
        // execute the function
        this.queue[i].func(this.parseData(event.data));
        // keep this item in the queue?
        if (this.queue[i].keep) {
          newQueue.push(this.queue[i]);
        }
      } else {
        newQueue.push(this.queue[i]);
      }
    }

    // update the queue
    this.queue = newQueue;
  }

  //
  parseData(data) {
    var parts = data.split(" ");
    switch (parts[0]) {
      case "id":
        return parts.slice(2).join(" ");
      case "info":
        var info = {};
        for (var i = 0; i < parts.length; i++) {
          switch (parts[i]) {
            case "depth":
            case "seldepth":
            case "multipv":
            case "nodes":
            case "nps":
            case "hashfull":
            case "tbhits":
            case "time":
              info[parts[i]] = parseInt(parts[i + 1]);
              break;
            case "score":
              info[parts[i]] = {
                cp: parts[i + 1] == "cp" ? parseInt(parts[i + 2]) : null,
                mate: parts[i + 1] == "mate" ? parseInt(parts[i + 2]) : null,
              };
              break;
            case "pv":
              info[parts[i]] = parts.slice(i + 1);
              break;
          }
        }

        return info;
    }

    return data;
  }

  // called on worker (stockfish) error
  onWorkerError(error) {
    console.error("received error from stockfish:");
    console.error(error);
  }

  // send isready command
  isReady() {
    // receive: readyok (once engine is ready, or indicating it's still alive)
    this.postMessage("isready");
  }

  // start a new game (needed for new positions)
  newGame() {
    this.postMessage("ucinewgame");
  }

  // set option value
  setOption(id, value) {
    // send: option name <id> [value <value>]
    this.postMessage(
      "setoption name " +
        id +
        (value !== undefined && value !== null ? " value " + value : "")
    );
  }

  // set multipv value
  setMultiPV(value) {
    console.log("setMultiPV", value, this.options.MultiPV);

    // validate the value
    if (
      value >= this.options.MultiPV.min &&
      value <= this.options.MultiPV.max
    ) {
      this.setOption("MultiPV", value);
    }
  }

  //

  /*

  SENDING:

  - send: ucinewgame (before each new game)
  - send: position [fen <fenstring> | startpos] moves <move1 movei> (setup board and play moves)
  - send: go (to start searching position + moves from above command)
  - go movetime <x> (search for x amount of mseconds)
  - go infinite (search until "stop" command is sent, DO NOT EXIT SEARCH WITHOUT SENDING THIS COMMAND!)
  - stop (stop calculating asap, will receive "bestmove" ??)
  - quit (quit asap)

  RECEIVING:

  - uciok (after sending "uci")
  - readyok (after sending "isready")
  - bestmove <move1> [<movei>]
  - info currmove etc
  - info depth seldepth time pv <move1> <movei> multipv score (from engine's pov) currmove currmovenumber

  */

  /*

  - evaluate a position: X amount of seconds
  - evaluate a position: ongoing
  - interrupt ongoing eval

  */

  // start evaluating a position, fen + moves with a time limit (0 = infinite, interrupt() needed to stop)
  evaluate(fen = "", moves = "", limit = 1000) {
    this.postMessage(
      "position " + (fen == "" ? "startpos" : "fen " + fen) + " moves " + moves
    );
    this.postMessage("go " + (limit == 0 ? "infinite" : "movetime " + limit));
  }

  // interrupt calculating asap
  interrupt() {
    this.postMessage("stop");
  }
}

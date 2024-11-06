import { Utils } from "./utils.js";
import { Modal } from "./modal.js";
import { UCI } from "./uci.js";

class Analyse {
  // the elements
  siteRadio = {
    chesscom: null,
    lichess: null,
  };

  siteUsername = null;

  periodCheckbox = {
    recent: null,
    older: null,
  };

  typeCheckbox = {
    daily: null,
    rapid: null,
    blitz: null,
    bullet: null,
  };

  startButton = null;

  analyseDialog = {
    modal: null,
    fieldsContainer: null,
    errorContainer: null,
    statusField: null,
    gameField: null,
    mistakesField: null,
    periodField: null,
    elapsedTimeField: null,
    errorField: null,
    stopButton: null,
    closeButton: null,
    startTime: null,
    intervalId: null,
    inProgress: false,
    isCompleted: false,
    isCancelled: false,
    processed: 0,
    period: "",
    totals: {
      inaccuracies: 0,
      mistakes: 0,
      blunders: 0,
    },
  };

  // the settings
  settings = [];

  // the UCI controller
  uci = null;

  games = [];
  currentGame = 0;
  currentMove = 0;
  engineMoveCount = 0;

  constructor() {
    // get the elements
    this.siteRadio.chesscom = document.getElementById("siteChessDotComRadio");
    this.siteRadio.lichess = document.getElementById("siteLichessRadio");

    this.siteUsername = document.getElementById("siteUsername");

    this.periodCheckbox.recent = document.getElementById("periodRecentRadio");
    this.periodCheckbox.older = document.getElementById("periodOlderRadio");

    this.typeCheckbox.daily = document.getElementById("typeDailyCheckbox");
    this.typeCheckbox.rapid = document.getElementById("typeRapidCheckbox");
    this.typeCheckbox.blitz = document.getElementById("typeBlitzCheckbox");
    this.typeCheckbox.bullet = document.getElementById("typeBulletCheckbox");

    this.startButton = document.getElementById("startButton");

    // attach event handlers
    this.siteRadio.chesscom.addEventListener(
      "change",
      this.switchSite.bind(this)
    );
    this.siteRadio.lichess.addEventListener(
      "change",
      this.switchSite.bind(this)
    );

    this.siteUsername.addEventListener(
      "input",
      this.toggleStartButton.bind(this)
    );
    this.periodCheckbox.recent.addEventListener(
      "click",
      this.toggleStartButton.bind(this)
    );
    this.periodCheckbox.older.addEventListener(
      "click",
      this.toggleStartButton.bind(this)
    );
    this.typeCheckbox.daily.addEventListener(
      "click",
      this.toggleStartButton.bind(this)
    );
    this.typeCheckbox.rapid.addEventListener(
      "click",
      this.toggleStartButton.bind(this)
    );
    this.typeCheckbox.blitz.addEventListener(
      "click",
      this.toggleStartButton.bind(this)
    );
    this.typeCheckbox.bullet.addEventListener(
      "click",
      this.toggleStartButton.bind(this)
    );

    this.startButton.addEventListener("click", this.analyseGames.bind(this));

    // get the modal elements
    this.analyseDialog.modal = document.getElementById("analyseModal");
    this.analyseDialog.fieldsContainer =
      document.getElementById("analyseModalFields");
    this.analyseDialog.errorContainer =
      document.getElementById("analyseModalError");

    var fields = this.analyseDialog.fieldsContainer.getElementsByTagName("p");

    this.analyseDialog.statusField = fields[0];
    this.analyseDialog.gameField = fields[1];
    this.analyseDialog.periodField = fields[2];
    this.analyseDialog.mistakesField = fields[3];
    this.analyseDialog.elapsedTimeField = fields[4];

    fields = this.analyseDialog.errorContainer.getElementsByTagName("p");

    this.analyseDialog.errorField = fields[0];

    this.analyseDialog.stopButton = document.getElementById(
      "analyseModalStopButton"
    );
    this.analyseDialog.closeButton = document.getElementById(
      "analyseModalCloseButton"
    );

    // register the modal
    Modal.register(
      this.analyseDialog.modal,
      [
        {
          element: this.analyseDialog.closeButton,
          action: "close",
        },
        {
          element: this.analyseDialog.stopButton,
          action: "close",
        },
      ],
      this.onCloseDialog.bind(this)
    );

    // get settings
    this.getSettings();
  }

  // get the settings
  getSettings() {
    console.log("getSettings:");

    var url = "/api/download/settings";

    // show the page loader
    Utils.showLoading();

    fetch(url, {
      method: "GET",
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:");
        console.log(response);

        // handle the response
        this.onGetSettings(response["settings"]);
      })
      .catch((error) => {
        console.error("Error:", error);
      })
      .finally(() => {
        // hide the page loader
        Utils.hideLoading();
      });
  }

  // restore the settings
  onGetSettings(settings) {
    console.log("onGetSettings:");
    console.log(settings);

    // store the settings
    this.settings = settings;

    // select the correct site
    if (this.settings.site == "Lichess") {
      this.siteRadio.lichess.checked = true;

      this.siteUsername.value = this.settings.lichess_username
        ? this.settings.lichess_username
        : "";
    } else {
      this.siteRadio.chesscom.checked = true;

      this.siteUsername.value = this.settings.chess_username
        ? this.settings.chess_username
        : "";
    }

    // toggle the start button
    this.toggleStartButton();
  }

  // switch sites
  switchSite() {
    // get the selected site
    this.settings.site = this.siteRadio.chesscom.checked
      ? this.siteRadio.chesscom.value
      : this.siteRadio.lichess.value;

    // set the correct username
    if (this.settings.site == "Lichess") {
      // store the current username
      this.settings.chess_username = this.siteUsername.value;
      // set the lichess username
      this.siteUsername.value = this.settings.lichess_username
        ? this.settings.lichess_username
        : "";
    } else {
      // store the current username
      this.settings.lichess_username = this.siteUsername.value;
      // set the chess.com username
      this.siteUsername.value = this.settings.chess_username
        ? this.settings.chess_username
        : "";
    }

    // toggle the start button
    this.toggleStartButton();
  }

  // toggle the start button
  toggleStartButton() {
    this.startButton.disabled =
      this.siteUsername.value == "" ||
      (!this.periodCheckbox.recent.checked &&
        !this.periodCheckbox.older.checked) ||
      (!this.typeCheckbox.daily.checked &&
        !this.typeCheckbox.rapid.checked &&
        !this.typeCheckbox.blitz.checked &&
        !this.typeCheckbox.bullet.checked);
  }

  // get the selected types array
  getSelectedTypes() {
    var types = [];
    if (this.typeCheckbox.daily.checked) {
      types.push("daily");
    }
    if (this.typeCheckbox.rapid.checked) {
      types.push("rapid");
    }
    if (this.typeCheckbox.blitz.checked) {
      types.push("blitz");
    }
    if (this.typeCheckbox.bullet.checked) {
      types.push("bullet");
    }

    return types;
  }

  // start analysing the games
  analyseGames() {
    console.log("analyseGames:");

    console.log("cancelled: " + this.analyseDialog.isCancelled);
    console.log("inProgress: " + this.analyseDialog.inProgress);

    // get the period
    var period = {
      recent: this.periodCheckbox.recent.checked,
      older: this.periodCheckbox.older.checked,
    };

    // if the last run is still in progress
    if (this.analyseDialog.inProgress) {
      return false;
    }

    // show the spinner
    this.startButton.children[0].classList.remove("hidden");
    this.startButton.disabled = true;

    // initialise the analyse process
    this.analyseDialog.inProgress = true;
    this.analyseDialog.isCompleted = false;
    this.analyseDialog.isCancelled = false;
    this.analyseDialog.period = "";
    this.analyseDialog.processed = 0;
    this.analyseDialog.totals.inaccuracies = 0;
    this.analyseDialog.totals.mistakes = 0;
    this.analyseDialog.totals.blunders = 0;

    // update the dialog fields
    this.updateDialogFields();
    // update the elapsed time field
    this.analyseDialog.elapsedTimeField.innerHTML = "";

    // set the stop button text
    this.analyseDialog.stopButton.innerHTML = "Stop analysing";

    // open the dialog
    Modal.open(this.analyseDialog.modal);

    // get the start time
    this.analyseDialog.startTime = new Date().getTime();

    // update the elapsed time
    this.analyseDialog.intervalId = setInterval(() => {
      var seconds =
        (new Date().getTime() - this.analyseDialog.startTime) / 1000;

      this.analyseDialog.elapsedTimeField.innerHTML = this.getDuration(seconds);
    }, 1000);

    // start analysing
    this.analyseNext();
  }

  // update the dialog fields, toggle them in case of error
  updateDialogFields(error = null) {
    // if we have an error
    if (error) {
      // show the error
      this.analyseDialog.errorContainer.classList.remove("hidden");
      this.analyseDialog.errorField.innerHTML = error;
      // hide the other fields
      this.analyseDialog.fieldsContainer.classList.add("hidden");
    } else {
      // show the fields
      this.analyseDialog.fieldsContainer.classList.remove("hidden");

      // set the mistakes text
      var mistakes =
        this.analyseDialog.totals.inaccuracies > 0
          ? this.analyseDialog.totals.inaccuracies +
            " " +
            (this.analyseDialog.totals.inaccuracies == 1
              ? "inaccuracy"
              : "inaccuracies")
          : "";

      mistakes +=
        this.analyseDialog.totals.mistakes > 0
          ? (mistakes != "" ? ", " : "") +
            this.analyseDialog.totals.mistakes +
            " " +
            (this.analyseDialog.totals.mistakes == 1 ? "mistake" : "mistakes")
          : "";

      mistakes +=
        this.analyseDialog.totals.blunders > 0
          ? (mistakes != "" ? ", " : "") +
            this.analyseDialog.totals.blunders +
            " " +
            (this.analyseDialog.totals.blunders == 1 ? "blunder" : "blunders")
          : "";

      if (this.analyseDialog.processed > 0) {
        var games =
          this.analyseDialog.processed > 0
            ? this.analyseDialog.processed +
              " game" +
              (this.analyseDialog.processed > 1 ? "s" : "")
            : "";

        mistakes =
          (mistakes !== "" ? mistakes : "No mistakes so far") +
          ' <span class="text-sm tc-faded">(' +
          games +
          ")</span>";
      }

      // update the values
      //this.analyseDialog.statusField.innerHTML = "Downloading your games";
      /*
        this.analyseDialog.processed == 0
          ? "In progress.."
          : this.analyseDialog.processed + " games processed";
          */
      //this.analyseDialog.gameField.innerHTML = this.analyseDialog.processed > 0 ? "" : "";
      this.analyseDialog.mistakesField.innerHTML = mistakes;
      this.analyseDialog.periodField.innerHTML = this.analyseDialog.period;
      // hide the error
      this.analyseDialog.errorContainer.classList.add("hidden");
      this.analyseDialog.errorField.innerHTML = "";
    }
  }

  // called when the dialog gets closed (return false to cancel)
  onCloseDialog() {
    // stop the interval timer
    if (this.analyseDialog.intervalId) {
      clearInterval(this.analyseDialog.intervalId);
      this.analyseDialog.intervalId = null;
    }

    this.analyseDialog.isCancelled = true;

    return true;
  }

  // analyse the next set of games
  analyseNext() {
    console.log("analyseNext:");

    console.log("cancelled: " + this.analyseDialog.isCancelled);

    // if cancelled, don't proceed
    if (this.analyseDialog.isCancelled) {
      // end the progress
      this.analyseEndProgress();

      return false;
    }

    // if we have no more games left to process
    if (this.analyseDialog.isCompleted) {
      // update the games field
      this.analyseDialog.statusField.innerHTML =
        "No more games left to process";
      // clear the interval
      if (this.analyseDialog.intervalId) {
        clearInterval(this.analyseDialog.intervalId);
        this.analyseDialog.intervalId = null;
      }

      // update the stop button text
      this.analyseDialog.stopButton.innerHTML = "Close";
      this.analyseDialog.stopButton.classList.remove("btn-warning");
      this.analyseDialog.stopButton.classList.add("btn-primary");
      // end the progress
      this.analyseEndProgress();

      return;
    }

    // update the dialog fields
    this.updateDialogFields();

    // update the status fields
    this.analyseDialog.statusField.innerHTML =
      'Downloading from <span class="font-medium">' +
      (this.siteRadio.chesscom.checked
        ? this.siteRadio.chesscom.value
        : this.siteRadio.lichess.value) +
      "</span>";
    this.analyseDialog.gameField.innerHTML = "";

    var url = "/api/analyse/download";

    var data = {
      site: this.siteRadio.chesscom.checked ? "Chess.com" : "Lichess",
      username: this.siteUsername.value,
      period: {
        recent: this.periodCheckbox.recent.checked,
        older: this.periodCheckbox.older.checked,
      },
      type: this.getSelectedTypes(),
    };

    console.log("before fetch:");
    console.log(data);

    fetch(url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => {
        console.log(res);
        // if not a 200
        if (res.status !== 200) {
          throw new Error({
            code: res.status,
            message: res.error ? res.error : "Received an error.",
          });
        }

        return res.json();
      })
      .then((response) => {
        console.log("Success: " + response.status);
        console.log(response);

        // get the period
        this.analyseDialog.period = response.period;
        this.analyseDialog.periodField.innerHTML = response.period;

        // TEMP - testing with local engine..
        this.getEngineMoves(response);
      })
      .catch((error) => {
        console.error("Error:", error);

        // handle the error
        this.onAnalyseError(error);
      });
  }

  // handle an API error
  onAnalyseError(error) {
    // update the dialog fields
    this.updateDialogFields("Something went wrong, please try again later.");
    // clear the interval
    if (this.analyseDialog.intervalId) {
      clearInterval(this.analyseDialog.intervalId);
      this.analyseDialog.intervalId = null;
    }

    // update the stop button text
    this.analyseDialog.stopButton.innerHTML = "Close";
    this.analyseDialog.stopButton.classList.remove("btn-warning");
    this.analyseDialog.stopButton.classList.add("btn-primary");

    // end the progress
    this.analyseEndProgress();
  }

  // analyse end progress
  analyseEndProgress() {
    // no longer in progress
    this.analyseDialog.inProgress = false;
    // hide the spinner
    this.startButton.children[0].classList.add("hidden");
    this.startButton.disabled = false;
  }

  // get the engine moves
  getEngineMoves(response) {
    this.games = response.games;

    this.currentGame = 0;
    this.currentMove = 0;
    this.engineMoveCount = 0;

    // start the engine
    this.engineStart();
  }

  engineStart() {
    if (this.uci == null) {
      this.uci = new UCI();

      this.uci.onReceive("uciok", this.onEngineOK.bind(this));

      this.uci.startEngine();
      this.uci.sendUCI();

      this.uci.onReceive("info", this.onEngineInfo.bind(this), false);
      this.uci.onReceive("bestmove", this.onEngineBestMove.bind(this), false);
    } else {
      this.onEngineOK();
    }
  }

  engineStop() {
    if (this.uci !== null) {
      this.uci.stopEngine();
      this.uci = null;
    }
  }

  engineInterrupt() {
    console.info("Interrupting the engine..");

    this.uci.interrupt();
    //this.uci.isReady();

    //this.uci.onReceive("readyok", stockfish.stopEngine.bind(stockfish));
  }

  onEngineOK() {
    console.info("onEngineOK");

    this.uci.setMultiPV(3);

    this.uci.onReceive("readyok", this.onEngineReady.bind(this));

    this.uci.isReady();
  }

  onEngineReady() {
    console.info("onEngineReady");

    //
    this.engineNextGame();
  }

  engineNextGame() {
    // if we've analysed all games
    if (this.currentGame >= this.games.length) {
      // download the next games
      this.analyseNext();

      return true;
    }

    //
    var game = this.games[this.currentGame];

    console.log(game);

    // get the color
    var color = game.color.charAt(0).toUpperCase() + game.color.slice(1);

    //this.analyseDialog.statusField.innerHTML =
    //'Evaluating with <span class="font-medium">Stockfish</span> (0%)';
    this.analyseDialog.gameField.innerHTML =
      color + " vs " + game.opponent + " (" + game.type + ")";

    // send ucinewgame
    this.uci.newGame();

    // evaluate the next move once the new game command is finished
    this.uci.onReceive("readyok", this.engineNextEval.bind(this));
    this.uci.isReady();
  }

  engineNextEval() {
    console.info("engineNextEval", this.analyseDialog.isCancelled);

    // if cancelled, don't proceed
    if (this.analyseDialog.isCancelled) {
      // end the progress
      this.analyseEndProgress();

      return false;
    }

    var game = this.games[this.currentGame];

    console.info(this.currentGame, this.currentMove, game);

    while (this.currentMove < game.moves.length) {
      if (
        game.moves[this.currentMove].bestmoves == null &&
        !game.moves[this.currentMove].ignore
      ) {
        // get the line moves
        var moves = game.moves[this.currentMove].line.uci.join(" ");
        // add the current move
        moves = moves + " " + game.moves[this.currentMove].uci;

        //
        this.analyseDialog.statusField.innerHTML =
          'Evaluating with <span class="font-medium">Stockfish</span> (' +
          Math.round((this.engineMoveCount / game.engine) * 100) +
          "%)";

        //
        this.engineMoveCount++;

        // start the evaluation
        this.uci.evaluate("", moves, this.settings.analyse_engine_time);

        return true;
      }

      this.currentMove++;
    }

    //
    this.analyseDialog.statusField.innerHTML = "Analysing game for mistakes";

    //
    this.evaluateGame(this.games[this.currentGame]);

    return true;
  }

  evaluateGame(game) {
    var url = "/api/analyse/evaluate";

    var data = {
      game: game,
      site: this.siteRadio.chesscom.checked ? "Chess.com" : "Lichess",
      username: this.siteUsername.value,
      year: game.year,
      month: game.month,
      type: game.type,
    };

    fetch(url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => {
        console.log(res);
        // if not a 200
        if (res.status !== 200) {
          throw new Error({
            code: res.status,
            message: res.error ? res.error : "Received an error.",
          });
        }

        return res.json();
      })
      .then((response) => {
        console.log("Success: " + response.status);
        console.log(response);

        // update the number of processed games
        this.analyseDialog.processed++;

        // if completed, set the total (needed for lichess to end the analysis)
        if (response.completed) {
          this.analyseDialog.isCompleted = true;
        }

        // update the mistake totals
        this.analyseDialog.totals.inaccuracies += response.totals.inaccuracies;
        this.analyseDialog.totals.mistakes += response.totals.mistakes;
        this.analyseDialog.totals.blunders += response.totals.blunders;

        // update the mistakes field
        this.updateDialogFields();

        // evaluate & analyse the next game
        this.currentGame++;
        this.currentMove = 0;
        this.engineMoveCount = 0;

        // get the next game evals
        this.engineNextGame();
      })
      .catch((error) => {
        console.error("Error:", error);

        // handle the error
        this.onAnalyseError(error);
      });
  }

  onEngineInfo(info) {
    var game = this.games[this.currentGame];
    var turn = this.currentMove % 2 == 0 ? "w" : "b";

    var move = game.moves[this.currentMove];

    if (move.bestmoves == null) {
      move.bestmoves = [null, null, null];
    }

    // we need to invert the score if it's the opposite color move
    var invert =
      (game.color == "white" && turn == "b") ||
      (game.color == "black" && turn == "w");
    var cp =
      info.score.cp !== null && invert ? info.score.cp * -1 : info.score.cp;
    var mate =
      info.score.mate !== null && invert
        ? info.score.mate * -1
        : info.score.mate;

    move.bestmoves[info.multipv - 1] = {
      move: info.pv[0],
      depth: info.depth,
      cp: cp,
      mate: mate,
      inverted: invert,
      line: info.pv,
    };
  }

  onEngineBestMove(bestMove) {
    console.info("onEngineBestMove", bestMove);

    var game = this.games[this.currentGame];

    console.info(game.moves[this.currentMove]);

    // remove null evals (in case of multipv)
    for (
      var i = game.moves[this.currentMove].bestmoves.length - 1;
      i >= 0;
      i--
    ) {
      if (game.moves[this.currentMove].bestmoves[i] == null) {
        game.moves[this.currentMove].bestmoves.splice(i, 1);
      }
    }

    // get the next move eval
    this.currentMove++;
    this.engineNextEval();
  }

  // get a printable duration for a number of seconds (2h 14m 32s)
  getDuration(seconds) {
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds - h * 3600) / 60);
    var s = Math.floor(seconds - h * 3600 - m * 60);

    return (h > 0 ? h + "h " : "") + (h > 0 || m > 0 ? m + "m " : "") + s + "s";
  }
}

// initialise the Practice object once the page is loaded
document.addEventListener("DOMContentLoaded", (event) => {
  var analyse = new Analyse();
});

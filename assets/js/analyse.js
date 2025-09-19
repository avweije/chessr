import { Utils } from "utils";
import { EngineHelper } from "EngineHelper";

/**
 * Analyse controller for the analyse page.
 */
class Analyse {
  analyseDialog = {
    statusField: null,
    gameField: null,
    mistakesField: null,
    periodField: null,
    elapsedTimeField: null,
    errorField: null,
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
  settings = null;

  // the EngineHelper & UCI interface
  engineHelper = null;
  uci = null;

  games = [];
  currentGame = 0;
  currentMove = 0;
  engineMoveCount = 0;

  constructor() {
    // Get the elements
    this.getElements();
    // Add listeners
    this.addListeners();
    // Initialize the modal
    this.initAnalyseModal();
    // get settings
    this.getSettings();
  }

  // Get the data-elements
  getElements() {
    // Get the data-elements for reference
    this.elements = {};
    document.querySelectorAll("[data-element]").forEach(el => {
      if (el.dataset.element !== "yes") return;
      this.elements[el.id] = el;
    });
  }

  // Add event listeners
  addListeners() {
    // Site
    this.elements.siteChessDotComRadio.addEventListener(
      "change", this.switchSite.bind(this)
    );
    this.elements.siteLichessRadio.addEventListener(
      "change", this.switchSite.bind(this)
    );
    // Username
    this.elements.siteUsername.addEventListener(
      "input", this.toggleStartButton.bind(this)
    );
    // Period radio
    this.elements.periodRecentRadio.addEventListener(
      "click", this.toggleStartButton.bind(this)
    );
    this.elements.periodOlderRadio.addEventListener(
      "click", this.toggleStartButton.bind(this)
    );
    // Type of games checkboxes
    this.elements.typeDailyCheckbox.addEventListener(
      "click", this.toggleStartButton.bind(this)
    );
    this.elements.typeRapidCheckbox.addEventListener(
      "click", this.toggleStartButton.bind(this)
    );
    this.elements.typeBlitzCheckbox.addEventListener(
      "click", this.toggleStartButton.bind(this)
    );
    this.elements.typeBulletCheckbox.addEventListener(
      "click", this.toggleStartButton.bind(this)
    );
    // Start button
    this.elements.startButton.addEventListener("click", this.analyseGames.bind(this));
  }

  // Load the modals
  initAnalyseModal() {
    // Analyse modal
    const analyseModalBkgd = this.elements.analyseModal.getElementsByClassName("modal-background")[0];

    const fields = this.elements.analyseModalFields.getElementsByTagName("p");
    const statusField = fields[0];
    const gameField = fields[1];
    const periodField = fields[2];
    const mistakesField = fields[3];
    const elapsedTimeField = fields[4];

    const errorFields = this.elements.analyseModalError.getElementsByTagName("p");
    const errorField = errorFields[0];

    const showModal = () => this.elements.analyseModal.classList.add("is-active");
    const closeModal = () => {
      this.elements.analyseModal.classList.remove("is-active");
      this.onCloseDialog();
    };

    analyseModalBkgd.addEventListener("click", closeModal);
    this.elements.analyseModalCloseButton.addEventListener("click", closeModal);
    this.elements.analyseModalStopButton.addEventListener("click", closeModal);

    // Save references for later use
    this.analyseDialog.statusField = statusField;
    this.analyseDialog.gameField = gameField;
    this.analyseDialog.periodField = periodField;
    this.analyseDialog.mistakesField = mistakesField;
    this.analyseDialog.elapsedTimeField = elapsedTimeField;
    this.analyseDialog.errorField = errorField;

    this.showModal = showModal;
    this.closeModal = closeModal;
  }

  // Get the settings
  getSettings() {
    const url = "/api/download/settings";

    // Show the page loader
    Utils.showLoading();

    fetch(url, {
      method: "GET",
    })
      .then((res) => res.json())
      .then((response) => {
        // Handle the response
        this.onGetSettings(response["settings"]);
      })
      .catch((error) => {
        console.error("Error:", error);
      })
      .finally(() => {
        // Hide the page loader
        Utils.hideLoading();
      });
  }

  // Restore the settings
  onGetSettings(settings) {

    console.log('Analyse.js - onGetSettings', settings);

    // Store the settings
    this.settings = settings;
    // Create the EngineHelper instance
    this.engineHelper = new EngineHelper({ 
      duration: settings.analyse_engine_time,
      autoNewGame: false,
      receiveOnce: true,
      onReceive: this.onEngineInfo.bind(this)
    });

    console.log(this.engineHelper);

    // select the correct site
    if (this.settings.site == "Lichess") {
      this.elements.siteLichessRadio.checked = true;
      // Set username
      this.elements.siteUsername.value = this.settings.lichess_username
        ? this.settings.lichess_username
        : "";
    } else {
      this.elements.siteChessDotComRadio.checked = true;
      // Set username
      this.elements.siteUsername.value = this.settings.chess_username
        ? this.settings.chess_username
        : "";
    }

    // Toggle the start button
    this.toggleStartButton();
  }

  // Switch sites
  switchSite() {
    // get the selected site
    this.settings.site = this.elements.siteChessDotComRadio.checked
      ? this.elements.siteChessDotComRadio.value
      : this.elements.siteLichessRadio.value;

    // Set the correct username
    if (this.settings.site == "Lichess") {
      // Store the current username
      this.settings.chess_username = this.elements.siteUsername.value;
      // Set the lichess username
      this.elements.siteUsername.value = this.settings.lichess_username
        ? this.settings.lichess_username
        : "";
    } else {
      // Store the current username
      this.settings.lichess_username = this.elements.siteUsername.value;
      // Set the chess.com username
      this.elements.siteUsername.value = this.settings.chess_username
        ? this.settings.chess_username
        : "";
    }

    // Toggle the start button
    this.toggleStartButton();
  }

  // Toggle the start button
  toggleStartButton() {
    const periodSelected = this.elements.periodRecentRadio.checked || this.elements.periodOlderRadio.checked;
    const typeSelected = this.elements.typeDailyCheckbox.checked || this.elements.typeRapidCheckbox.checked
      || this.elements.typeBlitzCheckbox.checked || this.elements.typeBulletCheckbox.checked;
    
    this.elements.startButton.disabled = this.settings === null
      || this.elements.siteUsername.value === ''
      || !periodSelected
      || !typeSelected;
  }

  // Get the selected types array
  getSelectedTypes() {
    const types = [];
    if (this.elements.typeDailyCheckbox.checked) {
      types.push("daily");
    }
    if (this.elements.typeRapidCheckbox.checked) {
      types.push("rapid");
    }
    if (this.elements.typeBlitzCheckbox.checked) {
      types.push("blitz");
    }
    if (this.elements.typeBulletCheckbox.checked) {
      types.push("bullet");
    }

    return types;
  }

  // Start analysing the games
  analyseGames() {
    console.log("analyseGames:");

    console.log("cancelled: " + this.analyseDialog.isCancelled);
    console.log("inProgress: " + this.analyseDialog.inProgress);

    // get the period
    const period = {
      recent: this.elements.periodRecentRadio.checked,
      older: this.elements.periodOlderRadio.checked,
    };

    // if the last run is still in progress
    if (this.analyseDialog.inProgress) {
      return false;
    }

    // show the spinner
    this.elements.startButton.disabled = true;
    this.elements.startButton.classList.add("is-loading");

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
    this.elements.analyseModalStopButton.innerHTML = "Stop analysing";

    // open the dialog
    this.showModal();

    // get the start time
    this.analyseDialog.startTime = new Date().getTime();

    // update the elapsed time
    this.analyseDialog.intervalId = setInterval(() => {
      const seconds =
        (new Date().getTime() - this.analyseDialog.startTime) / 1000;

      this.analyseDialog.elapsedTimeField.innerHTML = Utils.getDuration(seconds);
    }, 1000);

    // Start the engine
    this.engineHelper.startEngine();

    // start analysing
    this.analyseNext();
  }

  // Update the dialog fields, toggle them in case of error
  updateDialogFields(error = null) {
    // if we have an error
    if (error) {
      // show the error
      this.elements.analyseModalError.classList.remove("is-hidden");
      this.analyseDialog.errorField.innerHTML = error;
      // hide the other fields
      this.elements.analyseModalFields.classList.add("is-hidden");
    } else {
      // show the fields
      this.elements.analyseModalFields.classList.remove("is-hidden");

      // set the mistakes text
      let mistakes =
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
        const games =
          this.analyseDialog.processed > 0
            ? this.analyseDialog.processed +
            " game" +
            (this.analyseDialog.processed > 1 ? "s" : "")
            : "";

        mistakes =
          (mistakes !== "" ? mistakes : "No mistakes so far") +
          ' <span class="is-size-6 has-text-faded">(' +
          games +
          ")</span>";
      }

      // Update the values
      this.analyseDialog.mistakesField.innerHTML = mistakes;
      this.analyseDialog.periodField.innerHTML = this.analyseDialog.period;
      // Hide the error
      this.elements.analyseModalError.classList.add("is-hidden");
      this.analyseDialog.errorField.innerHTML = "";
    }
  }

  // Called when the dialog gets closed (return false to cancel)
  onCloseDialog() {
    // stop the interval timer
    if (this.analyseDialog.intervalId) {
      clearInterval(this.analyseDialog.intervalId);
      this.analyseDialog.intervalId = null;
    }

    this.analyseDialog.isCancelled = true;

    return true;
  }

  // Analyse the next set of games
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
      this.elements.analyseModalStopButton.innerHTML = "Close";
      this.elements.analyseModalStopButton.classList.remove("is-warning");
      this.elements.analyseModalStopButton.classList.add("is-primary");
      // end the progress
      this.analyseEndProgress();

      return;
    }

    // update the dialog fields
    this.updateDialogFields();

    // update the status fields
    this.analyseDialog.statusField.innerHTML =
      'Downloading from <span class="has-text-weight-medium">' +
      (this.elements.siteChessDotComRadio.checked
        ? this.elements.siteChessDotComRadio.value
        : this.elements.siteLichessRadio.value) +
      "</span>";
    this.analyseDialog.gameField.innerHTML = "";

    const url = "/api/analyse/download";

    const data = {
      site: this.elements.siteChessDotComRadio.checked ? "Chess.com" : "Lichess",
      username: this.elements.siteUsername.value,
      period: {
        recent: this.elements.periodRecentRadio.checked,
        older: this.elements.periodOlderRadio.checked,
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

  // Handle an API error
  onAnalyseError(error) {
    // update the dialog fields
    this.updateDialogFields("Something went wrong, please try again later.");
    // clear the interval
    if (this.analyseDialog.intervalId) {
      clearInterval(this.analyseDialog.intervalId);
      this.analyseDialog.intervalId = null;
    }

    // update the stop button text
    this.elements.analyseModalStopButton.innerHTML = "Close";
    this.elements.analyseModalStopButton.classList.remove("is-warning");
    this.elements.analyseModalStopButton.classList.add("is-primary");

    // end the progress
    this.analyseEndProgress();
  }

  // Analyse end progress
  analyseEndProgress() {
    // no longer in progress
    this.analyseDialog.inProgress = false;
    // hide the spinner
    this.elements.startButton.disabled = false;
    this.elements.startButton.classList.remove("is-loading");
    // Stop the engine
    this.engineHelper.stopEngine();
  }

  // Get the engine moves
  getEngineMoves(response) {
    this.games = response.games;

    // Reset the current game
    this.currentGame = 0;
    // Analyse the next game
    this.engineNextGame();
  }

  /**
   * Analyse the next game. Downloads a game, gets the stockfish evaluations for
   * moves that aren't in our evaluations database and sends it back to the backend
   * for evaluation. Upon return, engineNextGame can be called for the next game.
   */
  engineNextGame() {
    // Reset the current move & engine move count
    this.currentMove = 0;
    this.engineMoveCount = 0;

    console.log("XX-engineNextGame:", this.currentGame, this.games.length);

    // If we've analysed all games
    if (this.currentGame >= this.games.length) {
      // Download the next games
      this.analyseNext();

      return true;
    }

    // Get the next game
    const game = this.games[this.currentGame];

    // Skip this game if we don't have any moves
    if (game.moves.length === 0) {
      // Analyse the next game
      this.currentGame++;
      this.engineNextGame();

      return;
    }

    // get the color
    const color = game.color.charAt(0).toUpperCase() + game.color.slice(1);

    this.analyseDialog.gameField.innerHTML =
      color + " vs " + game.opponent + " (" + game.type + ")";

    // send ucinewgame
    //this.uci.newGame();

    // evaluate the next move once the new game command is finished
    //this.uci.onReceive("readyok", this.engineNextEval.bind(this));
    //this.uci.isReady();

    // Start a new game
    this.engineHelper.startGame()
    .then(() => {

      console.log('Analyse.js - Engine game started, promise resolved.');

      // Start the next engine search
      this.engineNextEval();
    });
  }

  /**
   * Gets the engine evaluations for moves that we don't have in our evaluations database.
   * Calls the backend to evaluate the game once we have all engine evals.
   */
  engineNextEval() {
    console.info("XX-engineNextEval", this.analyseDialog.isCancelled);

    // if cancelled, don't proceed
    if (this.analyseDialog.isCancelled) {
      // end the progress
      this.analyseEndProgress();

      return false;
    }

    const game = this.games[this.currentGame];

    while (this.currentMove < game.moves.length) {

      const needsEngine = !(game.moves[this.currentMove].bestmoves?.length);

      if (needsEngine && !game.moves[this.currentMove].ignore) {
        // get the line moves
        let moves = game.moves[this.currentMove].line.uci.join(" ");
        // add the current move
        moves = moves + " " + game.moves[this.currentMove].uci;

        this.analyseDialog.statusField.innerHTML =
          'Evaluating with <span class="has-text-weight-medium">Stockfish</span> (' +
          Math.round((this.engineMoveCount / game.engine) * 100) +
          "%)";

        this.engineMoveCount++;

        // start the evaluation
        //this.uci.evaluate("", moves, this.settings.analyse_engine_time);

        console.log('Analyse.js - engineNextEval: moves', moves);

        // Start the search
        this.engineHelper.startSearch({ moves: moves });

        return true;
      }

      this.currentMove++;
    }

    this.analyseDialog.statusField.innerHTML = "Analysing game for mistakes";

    // Evaluate the game
    this.evaluateGame(this.games[this.currentGame]);

    return true;
  }

  // Evaluates a game at the backend
  evaluateGame(game) {
    const url = "/api/analyse/evaluate";

    const data = {
      game: game,
      site: this.elements.siteChessDotComRadio.checked ? "Chess.com" : "Lichess",
      username: this.elements.siteUsername.value,
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

        // Analyse the next game
        this.currentGame++;
        this.engineNextGame();
      })
      .catch((error) => {
        console.error("Error:", error);

        // handle the error
        this.onAnalyseError(error);
      });
  }


  onEngineInfo(info) {

    console.log('Analyse.js - onEngineInfo', info);
  
    // Get the current game and turn
    const game = this.games[this.currentGame];
    const turn = this.currentMove % 2 == 0 ? "w" : "b";
    // Get the current move
    const move = game.moves[this.currentMove];

    // Initialize the bestmoves array
    if (move.bestmoves == null) {
      move.bestmoves = [null, null, null];
    }

    // We need to invert the score if it's the opposite color move
    const invert =
      (game.color == "white" && turn == "b") ||
      (game.color == "black" && turn == "w");

    // Go through all the multi pv's
    for (let i=0;i<info.length;i++) {
      // Get the score and mate, inverted or normal
      const cp = info[i].score.cp !== null && invert ? info[i].score.cp * -1 : info[i].score.cp;
      const mate = info[i].score.mate !== null && invert
        ? info[i].score.mate * -1
        : info[i].score.mate;
      // Set the bestmoves array (bestmoves after this move)
      move.bestmoves[info[i].multipv - 1] = {
        move: info[i].pv[0],
        depth: info[i].depth,
        cp: cp,
        mate: mate,
        inverted: invert,
        line: info[i].pv,
      };
    }

    // get the next move eval
    this.currentMove++;
    this.engineNextEval();
  }
}

// Initialise the Practice object once the page is loaded
document.addEventListener("DOMContentLoaded", (event) => {
  const analyse = new Analyse();
});

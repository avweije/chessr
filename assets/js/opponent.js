import { Utils } from "./utils.js";
import { Modal } from "./modal.js";

import "../styles/opponent.css";

class Opponent {
  // the elements
  tabButtons = {
    download: null,
    analysis: null,
  };

  tabContainers = {
    download: null,
    analysis: null,
  };

  siteRadio = {
    chesscom: null,
    lichess: null,
  };

  siteUsername = null;
  lastUsername = null;

  typeCheckbox = {
    daily: null,
    rapid: null,
    blitz: null,
    bullet: null,
  };

  startButton = null;

  opponentContainer = null;

  opponentColorRadio = {
    white: null,
    black: null,
  };

  opponentMoves = {
    container: null,
    header: null,
    eco: null,
    first: null,
    pgn: null,
    info: null,
    repertoire: null,
    submit: null,
    suggestions: {
      text: null,
      button: null,
      container: null,
    },
    table: null,
  };

  opponentData = {
    moves: null,
    line: [],
  };

  analyseDialog = {
    modal: null,
    fieldsContainer: null,
    errorContainer: null,
    typeField: null,
    statusField: null,
    elapsedTimeField: null,
    matchesField: null,
    periodField: null,
    errorField: null,
    stopButton: null,
    closeButton: null,
    startTime: null,
    intervalId: null,
    inProgress: false,
    isCompleted: false,
    isCancelled: false,
    processed: 0,
    matches: 0,
    period: "",
  };

  // the settings
  settings = [];

  constructor() {
    // get the elements
    this.tabButtons.download = document.getElementById("opponentDownloadRadio");
    this.tabButtons.analysis = document.getElementById("opponentAnalysisRadio");

    this.tabContainers.download = document.getElementById(
      "opponentDownloadTab"
    );
    this.tabContainers.analysis = document.getElementById(
      "opponentAnalysisTab"
    );

    this.siteRadio.chesscom = document.getElementById("siteChessDotComRadio");
    this.siteRadio.lichess = document.getElementById("siteLichessRadio");

    this.siteUsername = document.getElementById("siteUsername");

    this.typeCheckbox.daily = document.getElementById("typeDailyCheckbox");
    this.typeCheckbox.rapid = document.getElementById("typeRapidCheckbox");
    this.typeCheckbox.blitz = document.getElementById("typeBlitzCheckbox");
    this.typeCheckbox.bullet = document.getElementById("typeBulletCheckbox");

    this.startButton = document.getElementById("startButton");

    this.opponentContainer = document.getElementById("opponentContainer");

    this.opponentColorRadio.white = document.getElementById(
      "opponentColorWhiteRadio"
    );
    this.opponentColorRadio.black = document.getElementById(
      "opponentColorBlackRadio"
    );

    this.opponentMoves.container = document.getElementById(
      "opponentMovesContainer"
    );
    this.opponentMoves.header = document.getElementById("opponentMovesHeader");
    this.opponentMoves.eco = document.getElementById("opponentMovesEco");
    this.opponentMoves.first = document.getElementById(
      "opponentMovesFirstButton"
    );
    this.opponentMoves.pgn = document.getElementById("opponentMovesPgn");
    this.opponentMoves.info = document.getElementById("opponentMovesInfo");
    this.opponentMoves.repertoire = document.getElementById(
      "opponentMovesRepertoire"
    );
    this.opponentMoves.submit = document.getElementById(
      "opponentMoveSubmitButton"
    );
    this.opponentMoves.suggestions.text = document.getElementById(
      "opponentMoveSuggestions"
    );
    this.opponentMoves.suggestions.button = document.getElementById(
      "opponentMoveSuggestionsButton"
    );
    this.opponentMoves.suggestions.container = document.getElementById(
      "opponentMoveSuggestionsContainer"
    );
    this.opponentMoves.table = document.getElementById("opponentMovesTable");

    // attach event handlers
    this.tabButtons.download.addEventListener(
      "change",
      this.switchTab.bind(this)
    );
    this.tabButtons.analysis.addEventListener(
      "change",
      this.switchTab.bind(this)
    );

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

    // switch opponent event handlers
    for (var i = 0; i < this.opponentContainer.children.length; i++) {
      this.opponentContainer.children[i].children[0].addEventListener(
        "click",
        this.onSwitchOpponent.bind(this)
      );
    }

    // switch opponent color event handlers
    this.opponentColorRadio.white.addEventListener(
      "click",
      this.onSwitchColor.bind(this)
    );
    this.opponentColorRadio.black.addEventListener(
      "click",
      this.onSwitchColor.bind(this)
    );

    // moves goto first button
    this.opponentMoves.first.addEventListener(
      "click",
      this.onGotoFirst.bind(this)
    );

    // open move in repertoire button
    this.opponentMoves.submit.addEventListener(
      "click",
      this.onOpenLineInRepertoire.bind(this)
    );

    // show suggestions
    this.opponentMoves.suggestions.button.addEventListener(
      "click",
      this.onToggleSuggestions.bind(this)
    );

    // get the modal elements
    this.analyseDialog.modal = document.getElementById("analyseModal");
    this.analyseDialog.fieldsContainer =
      document.getElementById("analyseModalFields");
    this.analyseDialog.errorContainer =
      document.getElementById("analyseModalError");

    var fields = this.analyseDialog.fieldsContainer.getElementsByTagName("p");

    this.analyseDialog.typeField = fields[0];
    this.analyseDialog.statusField = fields[1];
    this.analyseDialog.matchesField = fields[2];
    this.analyseDialog.periodField = fields[3];
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
    // store the settings
    this.settings = {
      chess_username: "",
      lichess_username: "",
    };

    // toggle the start button
    this.toggleStartButton();
  }

  // switch tabs
  switchTab() {
    if (this.tabButtons.download.checked) {
      this.tabContainers.download.classList.remove("hidden");
      this.tabContainers.analysis.classList.add("hidden");
    } else {
      this.tabContainers.download.classList.add("hidden");
      this.tabContainers.analysis.classList.remove("hidden");

      // make sure we have the opponent moves
      this.getOpponentMoves();
    }
  }

  // get the currently selected opponent
  getSelectedOpponentId() {
    for (var i = 0; i < this.opponentContainer.children.length; i++) {
      if (this.opponentContainer.children[i].children[0].checked) {
        // return the id
        return this.opponentContainer.children[i].children[0].getAttribute(
          "data-id"
        );
      }
    }

    return null;
  }

  // get the opponent details
  getOpponentMoves(refresh = false) {
    console.log("getOpponentMoves:", this.opponentData);

    // only if we don't have the data yet
    if (this.opponentData.moves !== null && !refresh) {
      return true;
    }

    // get the current opponent id
    var id = this.getSelectedOpponentId();

    console.log("currentlySelectedId:", id);

    // if no opponent is selected
    if (id == null || id == "") {
      return false;
    }

    var url = "/api/opponent/" + encodeURIComponent(id);

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
        this.onGetOpponent(response);
      })
      .catch((error) => {
        console.error("Error:", error);
      })
      .finally(() => {
        // hide the page loader
        Utils.hideLoading();
      });
  }

  // show the opponent details
  onGetOpponent(moves) {
    console.log("onGetOpponent:");
    console.log(moves);

    // store the moves
    this.opponentData.moves = moves;
    this.opponentData.line = [];

    // load the suggestions
    this.loadMoveSuggestions();
    // show the opponent moves container
    this.opponentMoves.container.classList.remove("hidden");
    // reload the table
    this.loadOpponentMoves();
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
      // attach the lichess datalist
      this.siteUsername.setAttribute("list", "siteUsernameDataListLichess");
    } else {
      // store the current username
      this.settings.lichess_username = this.siteUsername.value;
      // set the chess.com username
      this.siteUsername.value = this.settings.chess_username
        ? this.settings.chess_username
        : "";
      // attach the chess.com datalist
      this.siteUsername.setAttribute("list", "siteUsernameDataListChessCom");
    }

    // toggle the start button
    this.toggleStartButton();
  }

  // toggle the start button
  toggleStartButton() {
    this.startButton.disabled =
      this.siteUsername.value == "" ||
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
      recent: 1,
      older: 1,
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
    this.analyseDialog.processed = 0;
    this.analyseDialog.matches = 0;
    this.analyseDialog.period = "";

    // update the dialog fields
    this.updateDialogFields();

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
      // get the types
      var types = this.getSelectedTypes();
      // show the fields
      this.analyseDialog.fieldsContainer.classList.remove("hidden");

      console.log("updateFields:");

      // update the values
      this.analyseDialog.typeField.innerHTML = types
        .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
        .join(", ");
      this.analyseDialog.statusField.innerHTML =
        this.analyseDialog.processed == 0
          ? "In progress.."
          : this.analyseDialog.processed + " games processed";
      this.analyseDialog.matchesField.innerHTML =
        this.analyseDialog.matches == 0
          ? ""
          : this.analyseDialog.matches +
            " matching " +
            (this.analyseDialog.matches > 1 ? "games" : "game") +
            " found";
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
        "No more games left to process.";
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

    //var url = "/api/download/games/{year}/{month}";
    var url = "/api/analyse/opponent";

    var data = {
      site: this.siteRadio.chesscom.checked ? "Chess.com" : "Lichess",
      username: this.siteUsername.value,
      period: {
        recent: 1,
        older: 1,
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

        // update the totals
        this.analyseDialog.processed =
          this.analyseDialog.processed + response.processed;
        this.analyseDialog.matches =
          this.analyseDialog.matches + response.matches;
        this.analyseDialog.period = response.period;

        // if completed, set the total (needed for lichess to end the analysis)
        if (response.completed) {
          this.analyseDialog.isCompleted = true;
        }

        // if the opponent is new, we need to add them to the analysis tab
        if (response.opponent.new) {
          this.addOpponentToAnalysis(response.opponent);
        }

        // analyse the next set of games
        this.analyseNext();
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

  // get a printable duration for a number of seconds (2h 14m 32s)
  getDuration(seconds) {
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds - h * 3600) / 60);
    var s = Math.floor(seconds - h * 3600 - m * 60);

    return (h > 0 ? h + "h " : "") + (h > 0 || m > 0 ? m + "m " : "") + s + "s";
  }

  // switch opponents
  onSwitchOpponent() {
    console.log("onSwitchOpponent:");

    // get the opponent moves
    this.getOpponentMoves(true);
  }

  // switch opponent color
  onSwitchColor() {
    console.log("onSwitchColor:");

    // if we don't have any data yet
    if (this.opponentData.moves === null) {
      return false;
    }

    // reset the line
    this.opponentData.line = [];
    // load the suggestions
    this.loadMoveSuggestions();
    // reload the opponent moves
    this.loadOpponentMoves();
  }

  // check if opponent is new, if so, see if we need to add them to analysis tab
  addOpponentToAnalysis(opponent) {
    var found = false;

    for (var i = 0; i < this.opponentContainer.children.length; i++) {
      // if this is the correct username
      if (
        this.opponentContainer.children[i].children[0].value ==
        opponent.username
      ) {
        // get the site
        var site =
          this.opponentContainer.children[i].children[0].getAttribute(
            "data-site"
          );
        // it's a match if the site also matches
        found = site == opponent.site;
        if (found) {
          break;
        }
      }
    }

    if (!found) {
      // add the opponent box
      var box = document.createElement("div");
      box.className = "boxed-radio";

      var inp = document.createElement("input");
      inp.id = "opponentBoxRadio_" + opponent.id;
      inp.type = "radio";
      inp.name = "opponent_box";
      inp.value = opponent.username;
      inp.className = "peer hidden";

      // store the opponent id & site
      inp.setAttribute("data-id", opponent.site);
      inp.setAttribute("data-site", opponent.site);

      // add the event listener to switch opponents
      inp.addEventListener("click", this.onSwitchOpponent.bind(this));

      box.appendChild(inp);

      var lbl = document.createElement("label");
      lbl.className =
        "boxed-radio-label peer-checked:border-blue-300 peer-checked:bg-blue-100";
      lbl.htmlFor = "opponentBoxRadio_" + opponent.id;

      box.appendChild(lbl);

      var circle = document.createElement("div");
      circle.className =
        "boxed-radio-circle peer-checked:border-transparent peer-checked:bg-blue-400 peer-checked:ring-2";

      box.appendChild(circle);

      var sp = document.createElement("span");
      sp.className =
        "boxed-radio-text peer-disabled:text-gray-300 peer-disabled:dark:text-gray-500 peer-checked:text-gray-700";

      var p1 = document.createElement("p");
      p1.className = "text-left mb-1";
      p1.innerHTML = opponent.username;

      sp.appendChild(p1);

      var p2 = document.createElement("p");
      p2.className = "text-left text-sm opacity-70";
      p2.innerHTML = opponent.site;

      sp.appendChild(p2);

      box.appendChild(sp);

      this.opponentContainer.appendChild(box);
    }
  }

  // get the current move we're on
  getCurrent() {
    console.log("getCurrent", this.opponentData.line);

    var current = this.opponentColorRadio.white.checked
      ? this.opponentData.moves.white
      : this.opponentData.moves.black;

    for (var i = 0; i < this.opponentData.line.length; i++) {
      if (current.moves[this.opponentData.line[i]] == undefined) {
        console.error("Invalid line for opponent moves.");
        break;
      }

      current = current.moves[this.opponentData.line[i]];
    }

    return current;
  }

  //
  getCurrentMoves(current) {
    console.log("getCurrentMoves", current);

    // get the moves & the total for this position
    var moves = [];
    var total = 0;
    for (const [move, details] of Object.entries(current.moves)) {
      details.move = move;
      details.total = details.wins + details.draws + details.losses;

      total = total + details.total;

      moves.push(details);
    }

    // sort the moves by % played
    moves.sort((a, b) => {
      if (a.wins + a.draws + a.losses === b.wins + b.draws + b.losses) return 0;
      return a.wins + a.draws + a.losses > b.wins + b.draws + b.losses ? -1 : 1;
    });

    // get the percentage played for each move
    for (var i = 0; i < moves.length; i++) {
      moves[i].percentage = Math.round((moves[i].total / total) * 100);
    }

    return moves;
  }

  // load the move suggestions
  loadMoveSuggestions() {
    console.log("loadMoveSuggestions");

    // get the suggestions
    var sugg = this.opponentColorRadio.white.checked
      ? this.opponentData.moves.white.suggestions
      : this.opponentData.moves.black.suggestions;

    console.log("sugg", sugg);

    // clear the suggestions
    while (this.opponentMoves.suggestions.container.children[1].firstChild) {
      this.opponentMoves.suggestions.container.children[1].removeChild(
        this.opponentMoves.suggestions.container.children[1].lastChild
      );
    }

    // load the suggestions
    for (var i = 0; i < sugg.length; i++) {
      var row = document.createElement("div");
      row.className =
        "flex justify-between items-center p-2" +
        (i > 0 ? " border-t border-tacao-300/60 dark:border-slate-900" : "");

      var col1 = document.createElement("div");
      col1.className = "text-left mr-6";

      // if we have an ECO code
      if (sugg[i].eco) {
        var pEco = document.createElement("p");
        pEco.className = "text-xs mb-px tc-faded";
        pEco.innerHTML = sugg[i].eco.name;
      }

      var pPgn = document.createElement("p");
      pPgn.className = "text-sm cursor-pointer font-semibold tc-link";
      pPgn.title = "Jump to this line";
      pPgn.innerHTML = sugg[i].pgn;
      pPgn.addEventListener(
        "click",
        ((line) => {
          return function (event) {
            // set the line
            this.opponentData.line = line;
            // reload the table
            this.loadOpponentMoves();
          };
        })(sugg[i].line).bind(this)
      );

      col1.appendChild(pEco);
      col1.appendChild(pPgn);

      var col2 = document.createElement("div");

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "flex appearance-none";
      btn.addEventListener(
        "click",
        ((idx) => {
          return function (event) {
            this.onOpenSuggestionInRepertoire(idx);
          };
        })(i).bind(this)
      );

      var icon = document.createElement("span");
      icon.className =
        "inline-block text-2xl px-1 tc-link-shade icon-[mdi--open-in-new]";
      icon.title = "Open in repertoire";

      btn.appendChild(icon);

      col2.appendChild(btn);

      row.appendChild(col1);
      row.appendChild(col2);

      this.opponentMoves.suggestions.container.children[1].appendChild(row);
    }
  }

  //
  loadOpponentMove(move) {
    console.log("loadOpponentMove", move);

    // add to the line
    this.opponentData.line.push(move);
    // reload the table
    this.loadOpponentMoves();
  }

  // load the opponent moves table
  loadOpponentMoves(fetchGameMoves = true) {
    console.log("loadOpponentMoves:", this.opponentData.line);

    // update the header
    this.updateOpponentPgn();

    console.log("afterUpdateOpp");

    // clear the table
    while (this.opponentMoves.table.firstChild) {
      this.opponentMoves.table.removeChild(this.opponentMoves.table.lastChild);
    }

    //
    // - find the corrent line / moves
    //
    // - show the header (current line / pgn, browser buttons? back button, current move info?)
    //

    // get the current line
    var current = this.getCurrent();

    console.log("current", current);

    // if we don't have the moves for this line
    if (fetchGameMoves && !current.matches && current.fetched == 0) {
      // get the opponent game moves
      this.getOpponentGameMoves();

      return;
    }

    // get the moves for the current line
    var moves = this.getCurrentMoves(current);

    // get the move color
    var color = this.opponentData.line.length % 2 == 0 ? "white" : "black";

    // add the moves
    for (var i = 0; i < moves.length; i++) {
      // create the move holder
      var holder = document.createElement("div");
      holder.className =
        "opponent-move-holder " +
        color +
        (moves[i].percentage < 3 ? " sporadic-move" : "");

      // create the header part
      var hdr = document.createElement("div");
      hdr.className = "opponent-move-header";

      // the move
      var sp = document.createElement("span");
      sp.innerHTML = moves[i].move;

      hdr.appendChild(sp);

      // the percentage played
      sp = document.createElement("span");
      sp.innerHTML = moves[i].percentage + "%";

      hdr.appendChild(sp);

      // if we have this move in our repertoire
      if (moves[i].matches) {
        // add the checkmark span
        sp = document.createElement("span");
        sp.className = "opponent-move-checkmark";
        sp.innerHTML = '<span class="w-3 h-3 icon-[mdi--check-circle]"></span>';

        hdr.appendChild(sp);
      }

      // get the win/loss percentages
      var winPct = Math.round((moves[i].wins / moves[i].total) * 100);
      var lossPct = Math.round((moves[i].losses / moves[i].total) * 100);
      var diff = Math.abs(winPct - lossPct);

      // even = win/loss difference less than 3 or win/loss percentage difference of less than 10
      var rate =
        diff < 10 || Math.abs(moves[i].wins - moves[i].losses) < 3
          ? "even"
          : winPct > lossPct
          ? "win"
          : "loss";

      console.log(moves[i].total, winPct, lossPct, diff, rate);

      // create the footer part
      var ftr = document.createElement("div");
      ftr.className = "opponent-move-footer";
      ftr.innerHTML =
        '<span class="' +
        (rate == "win"
          ? "text-green-500"
          : rate == "even"
          ? "text-yellow-500"
          : "text-red-500") +
        '">W: ' +
        moves[i].wins +
        '</span><span class="' +
        (rate == "loss"
          ? "text-red-500"
          : rate == "even"
          ? "text-yellow-500"
          : "text-green-500") +
        '">L: ' +
        moves[i].losses +
        "</span>";

      holder.appendChild(hdr);
      holder.appendChild(ftr);

      holder.addEventListener(
        "click",
        ((move) => {
          return function (event) {
            console.log("before load opponent move:");
            console.log(this, event, move);
            // load the opponent move
            this.loadOpponentMove(move);
          };
        })(moves[i].move).bind(this)
      );

      // add the move to the table
      this.opponentMoves.table.appendChild(holder);
    }
  }

  // go back to the 1st position
  onGotoFirst() {
    console.log("onGotoFirst");

    // reset the line
    this.opponentData.line = [];
    // reload the table
    this.loadOpponentMoves();
  }

  // go back to a certain move in the line
  onGotoMove(idx) {
    console.log("onGotoMove", idx);

    // reset the line to the index
    var temp = this.opponentData.line.splice(idx + 1);

    console.log(temp, this.opponentData.line);

    // reload the table
    this.loadOpponentMoves();
  }

  // open the current line in our repertoire
  onOpenLineInRepertoire() {
    console.log("onOpenLineInRepertoire");

    // clear the form inputs
    while (document.forms["opponentMoveForm"].firstChild) {
      document.forms["opponentMoveForm"].removeChild(
        document.forms["opponentMoveForm"].lastChild
      );
    }

    // set the form action
    document.forms["opponentMoveForm"].action =
      "./repertoire/" +
      (this.opponentColorRadio.white.checked ? "black" : "white");
    // add the form inputs
    for (var i = 0; i < this.opponentData.line.length; i++) {
      var inp = document.createElement("input");
      inp.type = "hidden";
      inp.name = "line[]";
      inp.value = this.opponentData.line[i];

      document.forms["opponentMoveForm"].appendChild(inp);
    }

    // submit the form
    document.forms["opponentMoveForm"].submit();
  }

  // open a suggestion line in our repertoire
  onOpenSuggestionInRepertoire(idx) {
    console.log("onOpenSuggestionInRepertoire", idx);

    // clear the form inputs
    while (document.forms["opponentMoveForm"].firstChild) {
      document.forms["opponentMoveForm"].removeChild(
        document.forms["opponentMoveForm"].lastChild
      );
    }

    // set the form action
    document.forms["opponentMoveForm"].action =
      "./repertoire/" +
      (this.opponentColorRadio.white.checked ? "black" : "white");

    // get the suggestion
    var sugg = this.opponentColorRadio.white.checked
      ? this.opponentData.moves.white.suggestions[idx]
      : this.opponentData.moves.black.suggestions[idx];

    console.log(sugg);

    // add the form inputs
    for (var i = 0; i < sugg.line.length; i++) {
      var inp = document.createElement("input");
      inp.type = "hidden";
      inp.name = "line[]";
      inp.value = sugg.line[i];

      document.forms["opponentMoveForm"].appendChild(inp);
    }

    // submit the form
    document.forms["opponentMoveForm"].submit();
  }

  // toggle the suggestion containers
  onToggleSuggestions(show) {
    console.log(
      "onToggleSuggestions",
      this.opponentMoves.suggestions.container,
      show
    );

    // make sure we don't have the event object, only accept if true or false
    if (show !== true && show !== false) {
      show = undefined;
    }

    // toggle the suggestions container
    if (
      this.opponentMoves.suggestions.container.classList.contains("hidden") &&
      (show === undefined || show == true)
    ) {
      console.log("show");

      this.opponentMoves.suggestions.container.classList.remove("hidden");
      // toggle the button icon
      this.opponentMoves.suggestions.button.children[0].classList.remove(
        "icon-[mdi--show-outline]"
      );
      this.opponentMoves.suggestions.button.children[0].classList.add(
        "icon-[mdi--hide-outline]"
      );
    } else {
      console.log("hide");

      this.opponentMoves.suggestions.container.classList.add("hidden");
      // toggle the button icon
      this.opponentMoves.suggestions.button.children[0].classList.remove(
        "icon-[mdi--hide-outline]"
      );
      this.opponentMoves.suggestions.button.children[0].classList.add(
        "icon-[mdi--show-outline]"
      );
    }
  }

  // get the current PGN as text
  getCurrentPgn() {
    // get the PGN
    var pgn = "";
    for (var i = 0; i < this.opponentData.line.length; i++) {
      pgn =
        pgn +
        (pgn !== "" ? " " : "") +
        (i % 2 == 0 ? i / 2 + 1 + ". " : "") +
        this.opponentData.line[i];
    }

    return pgn;
  }

  // update the opponent PGN, with links to browse through the moves
  updateOpponentPgn() {
    console.log("updateOpponentPgn", this.opponentData.line);

    // get the PGN
    this.opponentMoves.pgn.innerHTML =
      this.opponentData.line == 0
        ? "Click on a move to see the follow-up."
        : "";
    for (var i = 0; i < this.opponentData.line.length; i++) {
      if (i % 2 == 0) {
        var sp = document.createElement("span");
        sp.className = "opponent-pgn-text";
        sp.innerHTML = i / 2 + 1 + ".";

        this.opponentMoves.pgn.appendChild(sp);
      }

      var sp = document.createElement("span");
      sp.className = "opponent-pgn-move";
      sp.innerHTML = this.opponentData.line[i];

      sp.addEventListener(
        "click",
        ((idx) => {
          return function (event) {
            this.onGotoMove(idx);
          };
        })(i).bind(this)
      );

      this.opponentMoves.pgn.appendChild(sp);
    }

    // toggle the goto first button
    this.opponentMoves.first.disabled = this.opponentData.line.length == 0;

    // get the current line
    var current = this.getCurrent();
    // get the current moves
    var moves = this.getCurrentMoves(current);

    // get the totals
    var wins = current.wins !== undefined ? current.wins : 0;
    var losses = current.losses !== undefined ? current.losses : 0;
    if (current.wins == undefined && current.losses == undefined) {
      for (var i = 0; i < moves.length; i++) {
        wins = wins + moves[i].wins;
        losses = losses + moves[i].losses;
      }
    }

    console.log("total", wins, losses, current, moves);

    // set the ECO field
    this.opponentMoves.eco.innerHTML =
      this.opponentData.line.length > 0
        ? current.eco && current.eco.code
          ? "<span>" +
            current.eco.name +
            '</span><span class="text-sm">' +
            current.eco.code +
            "</span>"
          : "ECO unavailable"
        : "Starting position";

    // set the totals
    this.opponentMoves.info.children[0].children[0].innerHTML = wins;
    this.opponentMoves.info.children[1].children[0].innerHTML = losses;

    // show wether we have this move in our repertoire or not
    if (this.opponentData.line.length > 0) {
      this.opponentMoves.repertoire.children[0].innerHTML = current.matches
        ? "This move is in your repertoire."
        : "This move is not in your repertoire.";
      this.opponentMoves.repertoire.classList.remove("hidden");
      // hide the suggestions field & container
      this.opponentMoves.suggestions.text.classList.add("hidden");
      this.onToggleSuggestions(false);
    } else {
      // hide the in repertoire field
      this.opponentMoves.repertoire.children[0].innerHTML = "";
      this.opponentMoves.repertoire.classList.add("hidden");
      // show the suggestions if we have any
      var suggestions = this.opponentColorRadio.white.checked
        ? this.opponentData.moves.white.suggestions
        : this.opponentData.moves.black.suggestions;

      console.log("suggestions", suggestions);

      if (suggestions.length > 0) {
        this.opponentMoves.suggestions.text.children[0].innerHTML =
          "Found " +
          suggestions.length +
          " suggestion" +
          (suggestions.length > 1 ? "s" : "") +
          " for your " +
          (this.opponentColorRadio.white.checked ? "black" : "white") +
          " repertoire.";
        this.opponentMoves.suggestions.text.classList.remove("hidden");
      } else {
        this.opponentMoves.suggestions.text.classList.add("hidden");
        this.onToggleSuggestions(false);
      }
    }

    // update the PGN field
    //this.opponentMoves.pgn.innerHTML = pgn;
  }

  // get the opponent moves from their games in our DB (not in our repo, so not analysed moves)
  getOpponentGameMoves() {
    console.log("getOpponentGameMoves:");

    // show the page loader
    Utils.showLoading();

    //var url = "/api/download/games/{year}/{month}";
    var url = "/api/opponent/moves";

    var data = {
      id: this.getSelectedOpponentId(),
      color: this.opponentColorRadio.white.checked ? "white" : "black",
      pgn: this.getCurrentPgn(),
    };

    console.log("before post:");
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

        // get the current line
        var current = this.getCurrent();

        console.log(current);

        // store the moves in the current line
        current.fetched = 1;
        current.moves = response.moves;

        // reload the table with moves
        this.loadOpponentMoves(false);
      })
      .catch((error) => {
        console.error("Error:", error);
      })
      .finally(() => {
        // hide the page loader
        Utils.hideLoading();
      });
  }
}

// initialise the Practice object once the page is loaded
document.addEventListener("DOMContentLoaded", (event) => {
  var opponent = new Opponent();
});

import { Utils } from "utils";
import { PgnField } from "pgn-field";

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

  chooseOpponentText = null;
  opponentContainer = null;
  opponentRemoveButton = null;

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
    id: null,
    moves: null,
    line: [],
    needsRefresh: false,
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

  confirmDialog = {};
  connectDialog = {};
  disconnectDialog = {};

  // the settings
  settings = [];

  // the opponents
  opponents = [];

  // the PgnField instance
  pgnField = null;

  constructor() {
    // initialise the pgn field
    this.pgnField  = new PgnField({ 
      container: document.getElementById("opponentMovesPgnField"), 
      options: {
        navigationEnabled: false, 
        useVariations: true,
        withLinks: true,
        noLinkForLastMove: true,
        emptyText: "Click on a move to see the follow up."
      },
      handlers: {
        onGotoMove: (moveNr, variationIdx) => {
          
          console.log("Opponent.js - onGotoMove:", moveNr, variationIdx, this);

          this.onGotoMove(moveNr, variationIdx);
        }
      }
    });

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

    this.chooseOpponentText = document.getElementById("chooseOpponentText");
    this.opponentContainer = document.getElementById("opponentContainer");

    this.opponentRemoveButton = document.getElementById("opponentRemoveButton");
    this.opponentRemoveButton.addEventListener(
      "click",
      this.onRemoveOpponent.bind(this)
    );

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

    this.initModals();

    // get settings
    this.getSettings();

    // get the opponents
    this.getOpponents();
  }

  initModals() {
  // --- ANALYSE MODAL ---
  const analyseModal = document.getElementById("analyseModal");
  const analyseModalBkgd = analyseModal.getElementsByClassName("modal-background")[0];
  const analyseFieldsContainer = document.getElementById("analyseModalFields");
  const analyseFields = analyseFieldsContainer.getElementsByTagName("p");
  const analyseErrorContainer = document.getElementById("analyseModalError");
  const analyseError = analyseErrorContainer.getElementsByTagName("p");
  const analyseStop = document.getElementById("analyseModalStopButton");
  const analyseClose = document.getElementById("analyseModalCloseButton");

  const showAnalyseModal = () => analyseModal.classList.add("is-active");
  const closeAnalyseModal = () => {
    analyseModal.classList.remove("is-active");
    this.onCloseDialog();
  };

  analyseModalBkgd.addEventListener("click", closeAnalyseModal);
  analyseClose.addEventListener("click", closeAnalyseModal);
  analyseStop.addEventListener("click", closeAnalyseModal);

   
  this.analyseDialog.modal = analyseModal;
  this.analyseDialog.fieldsContainer = analyseFieldsContainer;
  this.analyseDialog.typeField = analyseFields[0];
  this.analyseDialog.statusField = analyseFields[1];
  this.analyseDialog.matchesField = analyseFields[2];
  this.analyseDialog.periodField = analyseFields[3];
  this.analyseDialog.elapsedTimeField = analyseFields[4];
  this.analyseDialog.errorContainer = analyseErrorContainer;
  this.analyseDialog.errorField = analyseError[0];
  this.analyseDialog.stopButton = analyseStop;
  this.analyseDialog.closeButton = analyseClose;
  this.analyseDialog.showModal = showAnalyseModal;
  this.analyseDialog.closeModal = closeAnalyseModal;

  this.showAnalyseModal = showAnalyseModal;
  this.closeAnalyseModal = closeAnalyseModal

  // --- CONFIRM MODAL ---
  const confirmModal = document.getElementById("confirmModal");
  const confirmModalBkgd = confirmModal.getElementsByClassName("modal-background")[0];
  const confirmClose = document.getElementById("confirmModalCloseButton");
  const confirmCancel = document.getElementById("confirmModalCancelButton");
  const confirmButton = document.getElementById("confirmModalConfirmButton");

  const showConfirmModal = () => confirmModal.classList.add("is-active");
  const closeConfirmModal = () => confirmModal.classList.remove("is-active");

  confirmModalBkgd.addEventListener("click", closeConfirmModal);
  confirmClose.addEventListener("click", closeConfirmModal);
  confirmCancel.addEventListener("click", closeConfirmModal);
  confirmButton.addEventListener("click", () => {
    this.onRemoveOpponentConfirmed();
    closeConfirmModal();
  });

  this.confirmDialog = {
    modal: confirmModal,
    closeButton: confirmClose,
    cancelButton: confirmCancel,
    confirmButton: confirmButton,
    showModal: showConfirmModal,
    closeModal: closeConfirmModal,
  };

  this.showConfirmModal = showConfirmModal;
  this.closeConfirmModal = closeConfirmModal

  // --- CONNECT MODAL ---
  const connectModal = document.getElementById("connectModal");
  const connectModalBkgd = connectModal.getElementsByClassName("modal-background")[0];
  const connectClose = document.getElementById("connectModalCloseButton");
  const connectCancel = document.getElementById("connectModalCancelButton");
  const connectConfirm = document.getElementById("connectModalConfirmButton");
  const connectOpponent = document.getElementById("connectModalOpponentUsername");
  const connectParentContainer = document.getElementById("connectModalParentAccountContainer");

  const showConnectModal = () => connectModal.classList.add("is-active");
  const closeConnectModal = () => connectModal.classList.remove("is-active");

  connectModalBkgd.addEventListener("click", closeConnectModal);
  connectClose.addEventListener("click", closeConnectModal);
  connectCancel.addEventListener("click", closeConnectModal);
  connectConfirm.addEventListener("click", () => {
    this.onConnectOpponentConfirmed();
    closeConnectModal();
  });

  this.connectDialog = {
    modal: connectModal,
    closeButton: connectClose,
    cancelButton: connectCancel,
    confirmButton: connectConfirm,
    opponentUsername: connectOpponent,
    parentAccountContainer: connectParentContainer,
    showModal: showConnectModal,
    closeModal: closeConnectModal,
  };

  this.showConnectModal = showConnectModal;
  this.closeConnectModal = closeConnectModal

  // --- DISCONNECT MODAL ---
  const disconnectModal = document.getElementById("disconnectModal");
  const disconnectModalBkgd = disconnectModal.getElementsByClassName("modal-background")[0];
  const disconnectClose = document.getElementById("disconnectModalCloseButton");
  const disconnectCancel = document.getElementById("disconnectModalCancelButton");
  const disconnectConfirm = document.getElementById("disconnectModalConfirmButton");
  const disconnectOpponent = document.getElementById("disconnectModalOpponentUsername");
  const disconnectChildContainer = document.getElementById("disconnectModalChildAccountContainer");

  const showDisconnectModal = () => disconnectModal.classList.add("is-active");
  const closeDisconnectModal = () => disconnectModal.classList.remove("is-active");

  disconnectModalBkgd.addEventListener("click", closeDisconnectModal);
  disconnectClose.addEventListener("click", closeDisconnectModal);
  disconnectCancel.addEventListener("click", closeDisconnectModal);
  disconnectConfirm.addEventListener("click", () => {
    this.onDisconnectOpponentConfirmed();
    closeDisconnectModal();
  });

  this.disconnectDialog = {
    modal: disconnectModal,
    closeButton: disconnectClose,
    cancelButton: disconnectCancel,
    confirmButton: disconnectConfirm,
    opponentUsername: disconnectOpponent,
    childAccountContainer: disconnectChildContainer,
    showModal: showDisconnectModal,
    closeModal: closeDisconnectModal,
  };

  this.showDisconnectModal = showDisconnectModal;
  this.closeDisconnectModal = closeDisconnectModal
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

  // get the opponents
  getOpponents() {
    var url = "/api/opponent";

    // show the page loader
    Utils.showLoading();

    //
    // create and show skeleton here?
    //
    this.opponentContainer.innerHTML = `
      <div class="skeleton-block skeleton-opponent-radio"></div>
      <div class="skeleton-block skeleton-opponent-radio"></div>
      <div class="skeleton-block skeleton-opponent-radio"></div>
    `;

    fetch(url, {
      method: "GET",
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:");
        console.log(response);

        // handle the response
        this.onGetOpponents(response["opponents"]);
      })
      .catch((error) => {
        console.error("Error:", error);
      })
      .finally(() => {
        // hide the page loader
        Utils.hideLoading();
      });
  }

  // store the opponents
  onGetOpponents(data) {
    this.opponents = data;

    // load the opponents radio boxes
    this.loadOpponents();
  }

  // switch tabs
  switchTab() {
    if (this.tabButtons.download.checked) {
      this.tabContainers.download.classList.remove("is-hidden");
      this.tabContainers.analysis.classList.add("is-hidden");
    } else {
      this.tabContainers.download.classList.add("is-hidden");
      this.tabContainers.analysis.classList.remove("is-hidden");

      // make sure we have the opponent moves
      this.getOpponentMoves(this.opponentData.needsRefresh);
    }
  }

  // get the currently selected opponent
  getSelectedOpponent() {
    const selected = this.opponentContainer.querySelector('.boxed-radio input[type="radio"]:checked');
    if (selected) {
        return {
          id: selected.getAttribute("data-id"),
          username: selected.value,
        };
    }

    return { id: "", username: "" };
  }

  // get the opponent details
  getOpponentMoves(refresh = false) {
    console.log("getOpponentMoves:", this.opponentData);

    // get the current opponent
    var sel = this.getSelectedOpponent();

    console.log("currentlySelectedId:", sel);

    // if no opponent is selected
    if (sel.id == "") {
      return false;
    }

    // only if we don't have the data yet
    if (
      this.opponentData.id == sel.id &&
      this.opponentData.moves !== null &&
      !refresh
    ) {
      return true;
    }

    // store the opponent id
    this.opponentData.id = sel.id;
    this.opponentData.moves = [];

    var url = "/api/opponent/" + encodeURIComponent(sel.id);

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
    this.opponentData.needsRefresh = false;

    // load the suggestions
    this.loadMoveSuggestions();
    // show the opponent moves container
    this.opponentMoves.container.classList.remove("is-hidden");
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
    this.startButton.disabled = true;
    this.startButton.classList.add("is-loading");

    // initialise the analyse process
    this.analyseDialog.inProgress = true;
    this.analyseDialog.isCompleted = false;
    this.analyseDialog.isCancelled = false;
    this.analyseDialog.processed = 0;
    this.analyseDialog.matches = 0;
    this.analyseDialog.period = "";

    // update the dialog fields
    this.updateDialogFields();

    // clear the elapsed time field
    this.analyseDialog.elapsedTimeField.innerHTML = "";

    // set the stop button text
    this.analyseDialog.stopButton.innerHTML = "Stop analysing";

    // open the dialog
    //Modal.open(this.analyseDialog.modal);
    this.showAnalyseModal();

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
      this.analyseDialog.errorContainer.classList.remove("is-hidden");
      this.analyseDialog.errorField.innerHTML = error;
      // hide the other fields
      this.analyseDialog.fieldsContainer.classList.add("is-hidden");
    } else {
      // get the types
      var types = this.getSelectedTypes();
      // show the fields
      this.analyseDialog.fieldsContainer.classList.remove("is-hidden");

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
      this.analyseDialog.errorContainer.classList.add("is-hidden");
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
      this.analyseDialog.stopButton.classList.remove("is-warning");
      this.analyseDialog.stopButton.classList.add("is-primary");
      // end the progress
      this.analyseEndProgress();

      return;
    }

    // update the dialog fields
    this.updateDialogFields();

    var url = "/api/opponent/analyse";

    var data = {
      site: this.siteRadio.chesscom.checked ? "Chess.com" : "Lichess",
      username: this.siteUsername.value,
      period: {
        recent: 1,
        older: 1,
      },
      type: this.getSelectedTypes(),
    };

    console.log("before fetch:", url);
    console.log(data);

    fetch(url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => {
        console.log('Response from POST:', res);
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

        // get the selected opponent
        var sel = this.getSelectedOpponent();

        // if the opponent is new, we need to add them to the analysis tab
        if (response.opponent.new) {
          this.addOpponentToAnalysis(response.opponent);
        } else if (sel.id == response.opponent.id) {
          this.opponentData.needsRefresh = true;
        } else {
          // check if it's a child of the selected opponent
          for (var i = 0; i < this.opponents.length; i++) {
            if (this.opponents[i].id == sel.id) {
              for (var y = 0; y < this.opponents[i].children.length; y++) {
                if (this.opponents[i].children[y].id == response.opponent.id) {
                  this.opponentData.needsRefresh = true;

                  break;
                }
              }

              break;
            }
          }
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
    this.analyseDialog.stopButton.classList.remove("is-warning");
    this.analyseDialog.stopButton.classList.add("is-primary");

    // end the progress
    this.analyseEndProgress();
  }

  // analyse end progress
  analyseEndProgress() {
    // no longer in progress
    this.analyseDialog.inProgress = false;
    // hide the spinner
    this.startButton.disabled = false;
    this.startButton.classList.remove("is-loading");
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
    this.getOpponentMoves();

    // show the remove opponent button
    this.opponentRemoveButton.classList.remove("is-hidden");
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
    
    //pgn-field
    this.pgnField.reset();

    // load the suggestions
    this.loadMoveSuggestions();
    // reload the opponent moves
    this.loadOpponentMoves();
  }

  // connect the opponent
  onConnectOpponent() {
    console.info("onConnectOpponent");

    // get the currently selected opponent
    var selected = this.getSelectedOpponent();

    // if no opponent is selected
    if (selected.id == "") {
      return false;
    }

    // set the username
    this.connectDialog.opponentUsername.innerHTML = selected.username;
    // disable the confirm button
    this.connectDialog.confirmButton.disabled = true;
    // load the parent accounts radio boxes
    this.loadConnectDialogParentAccounts(selected);

    // open the dialog
    //Modal.open(this.connectDialog.modal);
    this.showConnectModal();
  }

  // fired when the connect  opponent modal has been confirmed
  onConnectOpponentConfirmed(event) {
    var parentId = null;
    // get the selected main account
    for (
      var i = 0;
      i < this.connectDialog.parentAccountContainer.children.length;
      i++
    ) {
      if (
        this.connectDialog.parentAccountContainer.children[i].children[0]
          .checked
      ) {
        parentId =
          this.connectDialog.parentAccountContainer.children[
            i
          ].children[0].getAttribute("data-id");
        break;
      }
    }

    // close the modal
    //Modal.close(this.connectDialog.modal);
    this.closeConnectModal();

    // get the current opponent
    var selected = this.getSelectedOpponent();

    console.info("onConnectConfirm:", parentId, selected);

    // if no opponent is selected
    if (parentId == null || parentId == "" || selected.id == "") {
      return false;
    }

    var url = "/api/opponent/connect";

    var data = {
      opponent: selected.id,
      parent: parentId,
    };

    console.info(data);

    fetch(url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        console.log(response);

        // update the opponents
        this.connectOpponentToParent(parentId, selected);
      })
      .catch((error) => {
        console.error("Error:", error);
        // show the error icon
        Utils.showError();
      });
  }

  // update the opponents array, remove the child radio box, update the parent radio box
  connectOpponentToParent(parentId, opponent) {
    // remove the opponent as main account
    var opp = null;
    for (var i = 0; i < this.opponents.length; i++) {
      if (opponent.id == this.opponents[i].id) {
        opp = this.opponents.splice(i, 1)[0];
        break;
      }
    }

    console.info("child removed:", opp);

    if (opp == null) {
      return false;
    }

    // add the opponent as child
    var parent = null;
    for (var i = 0; i < this.opponents.length; i++) {
      if (parentId == this.opponents[i].id) {
        this.opponents[i].children.push(opp);

        parent = this.opponents[i];

        console.info("added to parent", parent);
        break;
      }
    }

    // remove the child radio box
    for (var i = 0; i < this.opponentContainer.children.length; i++) {
      var id =
        this.opponentContainer.children[i].children[0].getAttribute("data-id");

      console.info("id", id, opp);
      if (id == opp.id) {
        // remove it
        this.opponentContainer.removeChild(this.opponentContainer.children[i]);

        console.info("child radio removed");

        break;
      }
    }

    // update the parent radio box
    for (var i = 0; i < this.opponentContainer.children.length; i++) {
      var id =
        this.opponentContainer.children[i].children[0].getAttribute("data-id");

      console.info("id", id, parent);

      if (id == parent.id) {
        // add the connect link
        this.addOpponentRadioBoxConnect(
          this.opponentContainer.children[i],
          parent
        );

        console.info("connect div replaced");

        break;
      }
    }

    // refresh the opponent moves
    this.getOpponentMoves(true);
  }

  // load the connect dialog parent accounts container
  loadConnectDialogParentAccounts(selected) {
    // remove all radio boxes
    while (this.connectDialog.parentAccountContainer.firstChild) {
      this.connectDialog.parentAccountContainer.removeChild(
        this.connectDialog.parentAccountContainer.lastChild
      );
    }

    console.info("loadConnectDialogParentAccounts");
    console.info(this);
    console.info(this.opponents);
    console.info(this.connectDialog);

    // add the parent accounts
    for (var i = 0; i < this.opponents.length; i++) {
      // skip the selected opponent
      if (this.opponents[i].id == selected.id) {
        continue;
      }

      // create the radio box
      var box = this.createOpponentRadioBox(this.opponents[i], false, true);
      // add it
      this.connectDialog.parentAccountContainer.appendChild(box);
    }
  }

  // disconnect the opponent
  onDisconnectOpponent() {
    console.info("onDisconnectOpponent");

    // get the currently selected opponent
    var selected = this.getSelectedOpponent();

    // if no opponent is selected
    if (selected.id == "") {
      return false;
    }

    // set the username
    this.disconnectDialog.opponentUsername.innerHTML = selected.username;
    // disable the confirm button
    this.disconnectDialog.confirmButton.disabled = true;
    // load the child accounts radio boxes
    this.loadDisconnectDialogChildAccounts(selected);

    // open the dialog
    //Modal.open(this.disconnectDialog.modal);
    this.showDisconnectModal();
  }

  // fired when the disconnect opponent modal has been confirmed
  onDisconnectOpponentConfirmed(event) {
    var childsToRemove = [];
    // get the unchecked child account(s)
    for (
      var i = 0;
      i < this.disconnectDialog.childAccountContainer.children.length;
      i++
    ) {
      if (
        !this.disconnectDialog.childAccountContainer.children[i].children[0]
          .checked
      ) {
        childsToRemove.push(
          this.disconnectDialog.childAccountContainer.children[
            i
          ].children[0].getAttribute("data-id")
        );

        break;
      }
    }

    // close the modal
    //Modal.close(this.disconnectDialog.modal);
    this.closeDisconnectModal();

    // get the current opponent
    var selected = this.getSelectedOpponent();

    console.info("onDisconnectConfirm:", childsToRemove, selected);

    // if no opponent is selected
    if (childsToRemove.length == 0 || selected.id == "") {
      return false;
    }

    var url = "/api/opponent/disconnect";

    var data = {
      parent: selected.id,
      children: childsToRemove,
    };

    console.info(data);

    fetch(url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        console.log(response);

        // update the opponents
        this.disconnectOpponentsFromParent(selected.id, childsToRemove);
      })
      .catch((error) => {
        console.error("Error:", error);
        // show the error icon
        Utils.showError();
      });
  }

  // update opponents array, add radio boxes for disconnected children, update parent radio box
  disconnectOpponentsFromParent(parentId, children) {
    // add the children as main accounts (and remove them as children)
    var parent = null;
    for (var i = 0; i < this.opponents.length; i++) {
      if (parentId == this.opponents[i].id) {
        var children = [];
        // add the children as main account
        for (var y = 0; y < this.opponents[i].children.length; y++) {
          var found = false;
          for (var z = 0; z < children.length; z++) {
            if (children[z] == this.opponents[i].children[y].id) {
              // add the children array
              var main = this.opponents[i].children[y];
              main.children = [];

              // add the radio box
              var box = this.createOpponentRadioBox(main);
              this.opponentContainer.appendChild(box);

              // add the opponent
              this.opponents.push(main);

              found = true;
            }
          }

          if (!found) {
            children.push(this.opponents[i].children[y]);
          }
        }

        // override the children
        this.opponents[i].children = children;

        parent = this.opponents[i];

        break;
      }
    }

    // update the parent radio box
    for (var i = 0; i < this.opponentContainer.children.length; i++) {
      var id =
        this.opponentContainer.children[i].children[0].getAttribute("data-id");

      console.info("id", id, parent);

      if (id == parent.id) {
        // add the connect spans
        this.addOpponentRadioBoxConnect(
          this.opponentContainer.children[i],
          parent
        );

        console.info("connect span replaced");

        break;
      }
    }

    // refresh the opponent moves
    this.getOpponentMoves(true);
  }

  // load the disconnect dialog child accounts container
  loadDisconnectDialogChildAccounts(selected) {
    // remove all radio boxes
    while (this.disconnectDialog.childAccountContainer.firstChild) {
      this.disconnectDialog.childAccountContainer.removeChild(
        this.disconnectDialog.childAccountContainer.lastChild
      );
    }

    console.info("loadDisconnectDialogChildAccounts");
    console.info(this.opponents);
    console.info(this.disconnectDialog);

    // find the parent, add the child accounts
    for (var i = 0; i < this.opponents.length; i++) {
      if (this.opponents[i].id == selected.id) {
        for (var y = 0; y < this.opponents[i].children.length; y++) {
          // create the checkbox
          var box = this.createOpponentChildCheckBox(
            this.opponents[i].children[y]
          );
          // add it
          this.disconnectDialog.childAccountContainer.appendChild(box);
        }
      }
    }
  }

  // remove the opponent
  onRemoveOpponent() {
    console.info("onRemoveOpponent");

    // open the dialog
    //Modal.open(this.confirmDialog.modal);
    this.showConfirmModal();
  }

  // fired when the remove opponent modal has been confirmed
  onRemoveOpponentConfirmed(event) {
    // close the modal
    //Modal.close(this.confirmDialog.modal);
    this.closeConfirmModal();

    // get the current opponent id
    var id = this.getSelectedOpponent().id;

    // if no opponent is selected
    if (id == null || id == "") {
      return false;
    }

    var url = "/api/opponent/" + encodeURIComponent(id);

    fetch(url, {
      method: "DELETE",
    })
      .then((res) => res.json())
      .then((response) => {
        console.log(response);

        // remove the opponent from the analysis tab
        this.removeOpponentFromAnalysis();
      })
      .catch((error) => {
        console.error("Error:", error);
        // show the error icon
        Utils.showError();
      });
  }

  // load the opponents container
  loadOpponents() {
    // remove all radio boxes
    this.opponentContainer.innerHTML = "";

    console.info("loadOpponents");
    console.info(this.opponents);

    // toggle the choose opponent text
    if (this.opponents.length > 1) {
      this.chooseOpponentText.classList.remove("is-hidden");
    } else {
      this.chooseOpponentText.classList.add("is-hidden");
    }

    // add the parent accounts
    for (var i = 0; i < this.opponents.length; i++) {
      // create the radio box
      var box = this.createOpponentRadioBox(
        this.opponents[i],
        this.opponents.length == 1
      );
      // add it
      this.opponentContainer.appendChild(box);
    }
  }

  // check if opponent is new, if so, see if we need to add them to analysis tab
  addOpponentToAnalysis(opponent) {
    // add the children array
    opponent.children = [];
    // add to the opponents
    this.opponents.push(opponent);

    // toggle the choose opponent text
    if (this.opponents.length > 1) {
      this.chooseOpponentText.classList.remove("is-hidden");
    } else {
      this.chooseOpponentText.classList.add("is-hidden");
    }

    // add the opponent box
    var box = this.createOpponentRadioBox(opponent);

    this.opponentContainer.appendChild(box);
  }

  // create an opponent radio box
  createOpponentRadioBox(opponent, isChecked = false, forModal = false) {
    // add the opponent box
    var box = document.createElement("div");
    box.className = "boxed-radio";

    var inp = document.createElement("input");
    inp.id = "opponentBoxRadio_" + opponent.id + (forModal ? "_modal" : "");
    inp.type = "radio";
    inp.name = "opponent_box" + (forModal ? "_modal" : "");
    inp.value = opponent.username;
    inp.checked = isChecked;
    inp.className = "is-hidden";

    // store the opponent id & site
    inp.setAttribute("data-id", opponent.id);
    inp.setAttribute("data-site", opponent.site);

    // enable the confirm button
    if (forModal) {
      inp.addEventListener("click", () => {
        this.connectDialog.confirmButton.disabled = false;
      });
    } else {
      inp.addEventListener("click", this.onSwitchOpponent.bind(this));
    }

    box.appendChild(inp);

    var lbl = document.createElement("label");
    lbl.className =
      "boxed-radio-label peer-checked:border-blue-300 peer-checked:bg-blue-100";
    lbl.htmlFor =
      "opponentBoxRadio_" + opponent.id + (forModal ? "_modal" : "");

    box.appendChild(lbl);

    var circle = document.createElement("div");
    circle.className =
      "boxed-radio-circle peer-checked:border-transparent peer-checked:bg-blue-400 peer-checked:ring-2";

    box.appendChild(circle);

    var sp = document.createElement("span");
    sp.className =
      "boxed-radio-text peer-disabled:text-gray-300 peer-disabled:dark:text-gray-500 peer-checked:text-gray-700";

    var p1 = document.createElement("p");
    p1.className = "has-text-left mb-1 pr-3";
    p1.innerHTML = opponent.username;

    sp.appendChild(p1);

    var p2 = document.createElement("p");
    p2.className = "has-text-left is-size-6 pr-4 opacity-70";
    p2.innerHTML = opponent.site;

    sp.appendChild(p2);

    box.appendChild(sp);

    // add the bottom right element (icon or +3) only if needed
    if (!forModal || opponent.children.length > 0) {
      this.addOpponentRadioBoxConnect(box, opponent, forModal);
    }

    return box;
  }

  // create the radio box connect link or children count span
  addOpponentRadioBoxConnect(box, opponent, forModal = false) {
    // remove the current count & link spans
    var curr = box.getElementsByClassName("opponent-connect-children");
    if (curr.length == 1) {
      box.removeChild(curr[0]);
    }
    curr = box.getElementsByClassName("opponent-connect-link");
    if (curr.length == 1) {
      box.removeChild(curr[0]);
    }

    // add the child count span
    if (opponent.children.length > 0) {
      var cntSpan = document.createElement("span");
      cntSpan.className = "opponent-connect-children";
      cntSpan.innerHTML = "+" + opponent.children.length;

      box.appendChild(cntSpan);
    }

    // add the (dis)connect span
    if (!forModal) {
      var conSpan = document.createElement("span");
      conSpan.className = "opponent-connect-link";
      if (opponent.children.length > 0) {
        conSpan.innerHTML = '<i class="fa-solid fa-link-slash"></i>';

        conSpan.addEventListener("click", this.onDisconnectOpponent.bind(this));
      } else {
        conSpan.innerHTML = '<i class="fa-solid fa-link"></i>';

        conSpan.addEventListener("click", this.onConnectOpponent.bind(this));
      }

      box.appendChild(conSpan);
    }
  }

  // create an opponent child check box
  createOpponentChildCheckBox(opponent) {
    // add the opponent box
    var box = document.createElement("div");
    box.className = "boxed-checkbox";

    var inp = document.createElement("input");
    inp.id = "opponentChildBoxCheck_" + opponent.id;
    inp.type = "checkbox";
    inp.name = "opponent_child_checkbox";
    inp.value = opponent.username;
    inp.checked = true;
    inp.className = "is-hidden";

    // store the opponent id & site
    inp.setAttribute("data-id", opponent.id);

    // enable the confirm button
    inp.addEventListener("click", () => {
      this.disconnectDialog.confirmButton.disabled = false;
    });

    box.appendChild(inp);

    var lbl = document.createElement("label");
    lbl.className = "boxed-checkbox-label";
    lbl.htmlFor = "opponentChildBoxCheck_" + opponent.id;

    box.appendChild(lbl);

    var check = document.createElement("div");
    check.className = "boxed-checkbox-checkmark";
    check.innerHTML = '<i class="fa-solid fa-circle-check"></i>';

    box.appendChild(check);

    var circle = document.createElement("div");
    circle.className = "boxed-checkbox-circle";

    box.appendChild(circle);

    var sp = document.createElement("span");
    sp.className = "boxed-checkbox-text";
    sp.innerHTML = opponent.username;

    box.appendChild(sp);

    return box;
  }

  // remove an opponent from the analysis tab
  removeOpponentFromAnalysis() {
    for (var i = 0; i < this.opponentContainer.children.length; i++) {
      if (this.opponentContainer.children[i].children[0].checked) {
        // get the id
        var id =
          this.opponentContainer.children[i].children[0].getAttribute(
            "data-id"
          );

        // see if the opponent has children
        for (var y = 0; y < this.opponents.length; y++) {
          if (id == this.opponents[y].id) {
            if (this.opponents[y].children.length > 0) {
              for (var z = 0; z < this.opponents[y].children.length; z++) {
                // add the children array
                var main = this.opponents[y].children[z];
                main.children = [];

                // add the radio box
                var box = this.createOpponentRadioBox(main);
                this.opponentContainer.appendChild(box);

                // add the opponent
                this.opponents.push(main);
              }
            }

            // remove from the opponents array
            this.opponents.splice(y, 1);
            break;
          }
        }

        // remove the opponent radio box
        this.opponentContainer.removeChild(this.opponentContainer.children[i]);
        // hide the moves container & the remove button
        this.opponentMoves.container.classList.add("is-hidden");
        this.opponentRemoveButton.classList.add("is-hidden");

        break;
      }
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
        "is-flex is-justify-content-space-between is-align-items-center py-2 px-3";

      var col1 = document.createElement("div");
      col1.className = "has-text-left mr-6";

      // if we have an ECO code
      var pEco = document.createElement("p");
      pEco.className = "is-size-7 mb-0.5 has-text-faded";
      pEco.innerHTML = sugg[i].eco ? sugg[i].eco.name : "";

      var pPgn = document.createElement("p");
      pPgn.className = "is-size-6 p-0.5 cursor-pointer has-link-color";
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
      //col2.className = "px-1";

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "button is-small";
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
        "icon";
      icon.title = "Open in repertoire";
      icon.innerHTML = '<i class="fa-solid fa-up-right-from-square"></i>';

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

    // pgn-field
    this.pgnField.addMoveToHistory(move);

    // reload the table
    this.loadOpponentMoves();
  }

  // load the opponent moves table
  loadOpponentMoves(fetchGameMoves = true) {
    console.log("loadOpponentMoves:", this.opponentData.line);

    // update the move details
    this.updateOpponentMoveDetails();

    // toggle the goto first button
    this.opponentMoves.first.disabled = this.opponentData.line.length == 0;

    // reset to current line
    this.pgnField.reset("", this.opponentData.line);
    //this.pgnField.updatePgnField();

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
        sp.innerHTML = '<i class="fa-solid fa-circle-check"></i>';

        hdr.appendChild(sp);
      }

      // get the win/loss percentages
      var winPct = Math.round((moves[i].wins / moves[i].total) * 100);
      var lossPct = Math.round((moves[i].losses / moves[i].total) * 100);
      var diff = Math.abs(winPct - lossPct);

      // even = win/loss difference less than 3 or win/loss percentage difference of less than 8%
      var rate =
        diff < 8 || Math.abs(moves[i].wins - moves[i].losses) < 3
          ? "even"
          : winPct > lossPct
          ? "win"
          : "loss";

      //console.log(moves[i].total, winPct, lossPct, diff, rate);

      // create the footer part
      var ftr = document.createElement("div");
      ftr.className = "opponent-move-footer";
      ftr.innerHTML =
        '<span class="' +
        (rate == "win"
          ? "accuracy-green"
          : rate == "even"
          ? "accuracy-orange"
          : "accuracy-red") +
        '">W: ' +
        moves[i].wins +
        '</span><span class="' +
        (rate == "loss"
          ? "accuracy-red"
          : rate == "even"
          ? "accuracy-orange"
          : "accuracy-green") +
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

    // pgn-field
    this.pgnField.reset();

    // reload the table
    this.loadOpponentMoves();
  }

  // go back to a certain move in the line
  onGotoMove(moveNr) {
    console.log("onGotoMove", moveNr);

    // reset the line to the index
    var temp = this.opponentData.line.splice(moveNr);

    console.log(temp, this.opponentData.line);

    // pgn-field
    //this.pgnField.gotoMove(idx);
    this.pgnField.resetTo(moveNr);

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
      this.opponentMoves.suggestions.container.classList.contains("is-hidden") &&
      (show === undefined || show == true)
    ) {
      console.log("show");

      this.opponentMoves.suggestions.container.classList.remove("is-hidden");
      // toggle the button icon
      this.opponentMoves.suggestions.button.children[0].innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
    } else {
      console.log("hide");

      this.opponentMoves.suggestions.container.classList.add("is-hidden");
      // toggle the button icon
      this.opponentMoves.suggestions.button.children[0].innerHTML = '<i class="fa-solid fa-eye"></i>';
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

  // update the opponent move, wins, losses, ECO
  updateOpponentMoveDetails() {

    console.log("updateOpponentMoveDetails", this.opponentData.line);

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
      this.opponentMoves.repertoire.classList.remove("is-hidden");
      // hide the suggestions field & container
      this.opponentMoves.suggestions.text.classList.add("is-hidden");
      this.onToggleSuggestions(false);
    } else {
      // hide the in repertoire field
      this.opponentMoves.repertoire.children[0].innerHTML = "";
      this.opponentMoves.repertoire.classList.add("is-hidden");
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
        this.opponentMoves.suggestions.text.classList.remove("is-hidden");
      } else {
        this.opponentMoves.suggestions.text.classList.add("is-hidden");
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

    var url = "/api/opponent/moves";

    var data = {
      id: this.getSelectedOpponent().id,
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

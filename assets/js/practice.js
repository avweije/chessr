import {
  MyChessBoard,
  CUSTOM_MARKER_TYPE,
  BOARD_STATUS,
  BOARD_SETTINGS,
  PIECE_TILESIZE,
} from "chessboard";
import { CUSTOM_ARROW_TYPE } from "ThickerArrows";
import { MyChess } from "chess";
import { COLOR } from "../cm-chessboard/src/view/ChessboardView.js";
import {
  MARKER_TYPE,
  Markers,
} from "../cm-chessboard/src/extensions/markers/Markers.js";
import { ARROW_TYPE } from "../cm-chessboard/src/extensions/arrows/Arrows.js";
import { Utils } from "utils";

import "../styles/chessboard.css";

//const confetti = require("canvas-confetti");
//import confetti from "canvas-confetti";

/**
 * The controller class for the practice page.
 * Runs the practice lines, updates counters, etc.
 *
 * Analysis works differently than the other practice types (white, black, recommended, new).
 *
 * TODO:
 * - add ECO code to response from API? (so we don't have to use a worker to look it up = speed)
 *
 * @class Practice
 * @extends {MyChessBoard}
 */
class Practice extends MyChessBoard {
  // the current practice type & the available types
  type = "all";
  types = ["white", "black", "new", "recommended", "all", "analysis"];

  repertoireId = null;
  customRepertoireField = null;

  // the worker, used for looking up ECO codes
  worker = null;

  // the practice buttons
  buttons = {
    repertoireType: null,
    startPractice: null,
    giveHint: null,
    showPracticeInfo: null,
    prevMove: null,
    skipMove: null,

    analyseGameButton: null,
  };

  // the main practice containers
  containers = {
    group: null,
    groupSelect: null,

    counters: null,
    moveCounter: null,
    correctCounter: null,
    failedCounter: null,

    info: null,
    confirm: null,
    warning: null,
    hint: null,
  };

  // analysis containers
  pgnContainer = null;
  pgnNavigationContainer = null;

  suggestionContainer = null;
  suggestionField = null;
  suggestionSubmitButton = null;

  repertoireForm = null;

  playedMovesContainer = null;
  playedMovesList = null;

  practiceInfoContainer = null;
  practiceInfoOpenInRepertoireButton = null;
  practiceInfoFields = null;

  inPractice = false;

  repertoire = [];
  needsRefresh = false;

  lastMove = null;
  correctMoves = [];

  // the practice vars used when running a practice
  practice = {
    lines: [],
    moveCount: 0,
    skipCount: 0,
    lineIdx: 0,
    moveIdx: 0,
    failedCount: 0,
    lineColor: "",
    lineMoves: [],
    lineMovesMultiple: [],
    lineMovesPlayable: [],
    isMultiple: false,
    lineMovesPlayed: [],
    initialFen: "",
    currentFen: "",
    animateToPosition: true,
    animateFromBeginning: false,
    stopAnimating: false,
    isRunning: false,
    isInterrupted: false,
    paused: false,
    pausedFen: "",
  };

  hintCounter = 0;

  // the analysis elements
  analysis = {
    buttons: null,
    container: null,
    fields: null,
    saveButton: null,
    ignoreButton: null,
    discardButton: null,
    saveDialog: null,
    ignoreDialog: {},
    saveDialog: {},
  };

  settings = null;

  constructor() {
    super();

    // show the page loader
    Utils.showLoading();

    console.log("window.workerUrl:", workerUrl);
    
    // create the worker
    this.worker = new Worker(
      new URL(workerUrl, import.meta.url)
    );

    this.worker.onerror = function (e) {
      console.warn("Worker error:", e);
    };

    // listen to the results
    this.worker.addEventListener("message", this.onWorkerMessage.bind(this));

    // get the board element
    var el = document.getElementById("board");
    // get the practice type
    this.type = el.getAttribute("data-type");
    // get the repertoire id (from the roadmap)
    this.repertoireId = el.getAttribute("data-id");

    // get the practice type buttons
    this.buttons.repertoireType = document.getElementById(
      "practiceRepertoireButtons"
    );

    // get the custom repertoire field
    this.customRepertoireField = document.getElementById(
      "practiceCustomRepertoireField"
    );

    // get the save practice button
    this.buttons.startPractice = document.getElementById("startPracticeButton");
    this.buttons.giveHint = document.getElementById("giveHintButton");
    this.buttons.showPracticeInfo = document.getElementById(
      "showPracticeInfoButton"
    );
    this.buttons.prevMove = document.getElementById("prevMoveButton");
    this.buttons.skipMove = document.getElementById("skipMoveButton");

    this.buttons.analyseGameButton =
      document.getElementById("analyseGameButton");

    // get the counter elements
    this.containers.group = document.getElementById("practiceGroupContainer");
    this.containers.groupSelect = document.getElementById(
      "practiceGroupSelect"
    );

    this.containers.groupSelect.addEventListener(
      "change",
      this.onGroupSelectChange.bind(this)
    );

    this.containers.counters = document.getElementById(
      "practiceCountersContainer"
    );
    this.containers.moveCounter = document.getElementById(
      "practiceMoveCounter"
    );
    this.containers.correctCounter = document.getElementById(
      "practiceCorrectCounter"
    );
    this.containers.failedCounter = document.getElementById(
      "practiceFailedCounter"
    );
    // get the status containers
    this.containers.info = document.getElementById("infoContainer");
    this.containers.confirm = document.getElementById("confirmContainer");
    this.containers.warning = document.getElementById("warningContainer");
    this.containers.hint = document.getElementById("hintContainer");
    // get the played moves container & list
    this.playedMovesContainer = document.getElementById("playedMovesContainer");
    this.playedMovesList = document.getElementById("playedMovesList");

    this.pgnContainer = document.getElementById("pgnContainer");
    this.pgnNavigationContainer = document.getElementById(
      "pgnNavigationContainer"
    );

    this.suggestionContainer = document.getElementById("suggestionContainer");
    this.suggestionField = document.getElementById("suggestionField");
    this.suggestionSubmitButton = document.getElementById(
      "suggestionSubmitButton"
    );
    this.suggestionSubmitButton.addEventListener("click", () => {
      document.forms["repertoireForm"].submit();
    });

    this.repertoireForm = document.getElementById("repertoireForm");

    this.practiceInfoContainer = document.getElementById(
      "practiceInfoContainer"
    );

    this.practiceInfoOpenInRepertoireButton = document.getElementById(
      "practiceInfoOpenInRepertoireButton"
    );
    this.practiceInfoFields = document.getElementById("practiceInfoFields");

    this.practiceInfoOpenInRepertoireButton.addEventListener(
      "click",
      this.openInRepertoire.bind(this)
    );

    // set the pgn field
    this.setPgnField(document.getElementById("pgnField"));

    // attach click handler to the repertoire type buttons
    if (this.type != "custom") {
      this.initRepertoireButtons();
    }

    // attach click handler to the start practice button
    this.buttons.startPractice.addEventListener(
      "click",
      this.onStartPractice.bind(this)
    );
    this.buttons.giveHint.addEventListener("click", this.giveHint.bind(this));
    this.buttons.showPracticeInfo.addEventListener(
      "click",
      this.togglePracticeInfo.bind(this)
    );
    this.buttons.prevMove.addEventListener("click", () => {
      this.prevMove();
    });
    this.buttons.skipMove.addEventListener("click", () => {
      this.skipMove();
    });

    this.buttons.analyseGameButton.addEventListener(
      "click",
      this.onAnalyseGame.bind(this)
    );

    // attach pgn navigation button handlers
    this.pgnNavigationContainer.children[0].addEventListener(
      "click",
      this.gotoFirst.bind(this)
    );
    this.pgnNavigationContainer.children[1].addEventListener(
      "click",
      this.gotoPrevious.bind(this)
    );
    this.pgnNavigationContainer.children[2].addEventListener(
      "click",
      this.gotoNext.bind(this)
    );
    this.pgnNavigationContainer.children[3].addEventListener(
      "click",
      this.gotoLast.bind(this)
    );
    /*
    this.pgnNavigationContainer.children[4].addEventListener(
      "click",
      this.openInRepertoire.bind(this)
    );
    */

    // get the settings (and then create the board)
    this.getSettings();

    // get the entire repertoire
    this.getRepertoire(true);

    // initialise the analysis elements
    this.initAnalysis();

    // initialise the dialogs
    this.initModals();

    // hide the page loader
    Utils.hideLoading();
  }

  /**
   * Get the settings from the API and initialise the board.
   *
   * @memberof Practice
   */
  getSettings() {
    // show the page loader
    Utils.showLoading();

    var url = "/api/settings";

    fetch(url, {
      method: "GET",
    })
      .then((res) => res.json())
      .then((response) => {
        // store the settings
        this.onGetSettings(response.settings);
      })
      .catch((error) => {
        console.warn("Error:", error);
        // show the error icon
        Utils.showError();
      })
      .finally(() => {
        // hide the page loader
        Utils.hideLoading();
      });
  }

  /**
   * Initialise the board using the user settings.
   *
   * @param {*} settings
   * @memberof Practice
   */
  onGetSettings(settings) {
    // store the settings
    this.settings = settings;

    // get the board element
    var el = document.getElementById("board");
    // get the repertoire color
    this.color = el.getAttribute("data-color");

    // the board settings
    var boardSettings = {
      orientation: this.type == "black" ? COLOR.black : COLOR.white,
      style: {
        pieces: {},
      },
    };
    if (settings.board) {
      boardSettings.style.cssClass = settings.board;
    }
    if (settings.pieces) {
      boardSettings.style.pieces.file = "pieces/" + settings.pieces;
      boardSettings.style.pieces.tileSize = PIECE_TILESIZE.get(settings.pieces);
    }
    if (settings.animation) {
      boardSettings.style.animationDuration = settings.animation;
    }

    // create the chess board
    this.init(el, boardSettings);

    // disable move input
    this.disableMoveInput();
  }

  /**
   * Initialise the analysis elements.
   *
   * @memberof Practice
   */
  initAnalysis() {
    // get the elements
    this.analysis.buttons = document.getElementById("analysisGameButtons");
    this.analysis.container = document.getElementById("analysisGameContainer");
    this.analysis.fields = document.getElementById("analysisGameFields");
    this.analysis.saveButton = document.getElementById("analysisSaveButton");
    this.analysis.ignoreButton = document.getElementById(
      "analysisIgnoreButton"
    );
    this.analysis.discardButton = document.getElementById(
      "analysisDiscardButton"
    );

    // add the event listeners
    this.analysis.saveButton.addEventListener(
      "click",
      this.onAnalysisSave.bind(this)
    );
    this.analysis.ignoreButton.addEventListener(
      "click",
      this.onAnalysisIgnore.bind(this)
    );
    this.analysis.discardButton.addEventListener(
      "click",
      this.onAnalysisDiscard.bind(this)
    );
  }

  initModals() {
  // --- SAVE MODAL ---
  const saveModal = document.getElementById("saveModal");
  const saveModalBkgd = saveModal.getElementsByClassName("modal-background")[0];
  const saveClose = document.getElementById("saveModalCloseButton");
  const saveCancel = document.getElementById("saveModalCancelButton");
  const saveConfirm = document.getElementById("saveModalConfirmButton");

  const saveTextOneMove = document.getElementById("saveModalTextOneMove");
  const saveTextMultiple = document.getElementById("saveModalTextMultipleMoves");
  const saveMovesList = document.getElementById("saveModalMovesList");
  const saveRadioTopMove = document.getElementById("saveModalRadioTopMove");
  const saveRadioTop2 = document.getElementById("saveModalRadioTop2");
  const saveRadioTop3 = document.getElementById("saveModalRadioTop3");

  // Helper to show/hide modal
  const showSaveModal = () => saveModal.classList.add("is-active");
  const closeSaveModal = () => saveModal.classList.remove("is-active");

  // Attach handlers
  saveModalBkgd.addEventListener("click", closeSaveModal);
  saveClose.addEventListener("click", closeSaveModal);
  saveCancel.addEventListener("click", closeSaveModal);
  saveConfirm.addEventListener("click", () => {
    this.onAnalysisSaveConfirmed();
    closeSaveModal();
  });

  this.analysis.saveDialog = {
    textOneMove: saveTextOneMove,
    textMultipleMoves: saveTextMultiple,
    movesList: saveMovesList,
    radioTopMove: saveRadioTopMove,
    radioTop2: saveRadioTop2,
    radioTop3: saveRadioTop3
  };


  // --- IGNORE MODAL ---
  const ignoreModal = document.getElementById("ignoreModal");
  const ignoreModalBkgd = ignoreModal.getElementsByClassName("modal-background")[0];
  const ignoreClose = document.getElementById("ignoreModalCloseButton");
  const ignoreCancel = document.getElementById("ignoreModalCancelButton");
  const ignoreConfirm = document.getElementById("ignoreModalConfirmButton");

  const showIgnoreModal = () => ignoreModal.classList.add("is-active");
  const closeIgnoreModal = () => ignoreModal.classList.remove("is-active");

  ignoreModalBkgd.addEventListener("click", closeIgnoreModal);
  ignoreClose.addEventListener("click", closeIgnoreModal);
  ignoreCancel.addEventListener("click", closeIgnoreModal);
  ignoreConfirm.addEventListener("click", () => {
    this.onAnalysisIgnoreConfirmed();
    closeIgnoreModal();
  });

  // You can expose show functions if needed elsewhere
  this.showSaveModal = showSaveModal;
  this.closeSaveModal = closeSaveModal;
  this.showIgnoreModal = showIgnoreModal;
  this.closeIgnoreModal = closeIgnoreModal;
}


  /**
   * Handle the message from the worker.
   *
   * @param {*} e
   * @memberof Practice
   */
  onWorkerMessage(e) {
    console.info("onWorkerMessage", e);

    switch (e.data[0]) {
      case "getEco":
        if (e.data[3] == "custom") {
          // set the custom repertoire field
          this.customRepertoireField.children[0].children[0].innerHTML =
            e.data[1].Name + " (" + e.data[2] + ")";
        } else {
          // set the practice info ECO field
          this.practiceInfoFields.children[1].innerHTML =
            e.data[1].Code + ", " + e.data[1].Name;
        }
        break;
    }
  }

  /**
   * Called after a move is made (through chessboard.js).
   *
   * @param {*} move
   * @return {*}
   * @memberof Practice
   */
  afterMove(move) {
    try {
      // update the board status
      this.setStatus(BOARD_STATUS.default);

      // if practice is paused..
      if (this.practice.paused) {
        return true;
      }

      // get the last move
      this.lastMove = this.game.historyWithCorrectFen().pop();

      // is this the correct repertoire move?
      var isCorrect = this.practice.lineMoves.includes(this.lastMove.san);

      // if this is the correct move
      if (isCorrect) {
        // highlight the correct move
        this.board.removeMarkers();
        // remove arrows
        this.board.removeArrows();

        this.board.addMarker(CUSTOM_MARKER_TYPE.checkmark, move.to);
        this.board.addMarker(CUSTOM_MARKER_TYPE.squareGreen, move.from);
        this.board.addMarker(CUSTOM_MARKER_TYPE.squareGreen, move.to);

        // handle the next steps
        this.correctMovePlayed();
      } else {
        // update the status
        this.showWarning("That's not the correct move. Try again.");

        // if not already failed
        if (this.practice.failedCount == 0) {
          // add to the failed counter
          this.addFailedCount();
        } else if (this.practice.isMultiple) {
          // already failed before - only add to the counter if we have multiple moves that we failed
          if (
            this.practice.failedCount + this.practice.lineMovesPlayed.length <
            this.practice.lineMoves.length
          ) {
            // add to the failed counter
            this.addFailedCount();
          }
        }

        // add failed count in database for every fail?
        if (true) {
          // add to the failed count
          var failed = [];

          // if we have multiple moves here
          if (this.practice.isMultiple) {
            // add only the moves that had not yet been played correctly
            for (var i = 0; i < this.practice.lineMoves.length; i++) {
              if (
                !this.practice.lineMovesPlayed.includes(
                  this.practice.lineMoves[i]
                )
              ) {
                failed.push({
                  color: this.practice.lineColor,
                  fen: this.lastMove.before,
                  move: this.practice.lineMoves[i],
                  failed: 1,
                });
              }
            }
          } else {
            // add the move
            failed.push({
              color: this.practice.lineColor,
              fen: this.lastMove.before,
              move: this.practice.lineMoves[0],
              failed: 1,
            });
          }

          // save the move counters
          if (failed.length > 0) {
            this.saveMoveCounters(failed);
          }
        }

        // remember how many times we failed this move
        this.practice.failedCount++;

        // highlight the error move
        this.board.removeMarkers();
        // remove arrows
        this.board.removeArrows();

        this.board.addMarker(CUSTOM_MARKER_TYPE.cancel, move.to);
        this.board.addMarker(CUSTOM_MARKER_TYPE.squareRed, move.from);
        this.board.addMarker(CUSTOM_MARKER_TYPE.squareRed, move.to);

        // pause the board for a moment
        this.pauseBoard(() => {
          // reset position
          this.gameUndo();
          // remove markers
          this.board.removeMarkers();
          // remove arrows
          this.board.removeArrows();
          // wait on the next move
          this.waitOnMove();
        });
      }

      return true;
    } catch (err) {
      console.warn(err);

      return false;
    }
  }

  /**
   * Called after a jump was made to an existing move (through chessboard.js).
   *
   * @param {*} moveNr
   * @param {*} variationIdx
   * @memberof Practice
   */
  afterGotoMove(moveNr, variationIdx) {
    // toggle the pgn navigation buttons
    this.togglePgnNavigationButtons();
  }

  /**
   * Shows the PGN container.
   *
   * @memberof Practice
   */
  showPgnContainer() {
    this.pgnContainer.classList.remove("is-hidden");
  }

  /**
   * Hides the PGN container.
   *
   * @memberof Practice
   */
  hidePgnContainer() {
    this.pgnContainer.classList.add("is-hidden");
  }

  /**
   * Toggles the PGN navigation buttons.
   *
   * @memberof Practice
   */
  togglePgnNavigationButtons() {
    // toggle the pgn navigation buttons
    this.pgnNavigationContainer.children[0].disabled = this.isFirst();
    this.pgnNavigationContainer.children[1].disabled = this.isFirst();
    this.pgnNavigationContainer.children[2].disabled = this.isLast();
    this.pgnNavigationContainer.children[3].disabled = this.isLast();
  }

  // open the position in the repertoire
  openInRepertoire() {
    // clear the form
    while (this.repertoireForm.firstChild) {
      this.repertoireForm.removeChild(this.repertoireForm.lastChild);
    }

    // set the form action to the repertoire color
    this.repertoireForm.action = "./repertoire/" + this.practice.lineColor;

    var inp = document.createElement("input");
    inp.type = "hidden";
    inp.name = "fen";

    this.repertoireForm.appendChild(inp);

    for (var i = 0; i < this.game.history({ verbose: true }).length; i++) {
      var inp = document.createElement("input");
      inp.type = "hidden";
      inp.name = "line[]";
      inp.value = this.history[i].san;

      this.repertoireForm.appendChild(inp);
    }

    this.repertoireForm.submit();
  }

  /**
   * Suggestion Container functions.
   */

  showSuggestionContainer() {
    this.suggestionContainer.classList.remove("is-hidden");
  }

  hideSuggestionContainer() {
    this.suggestionContainer.classList.add("is-hidden");
  }

  updateSuggestionField(color, fen, suggestion) {
    // clear the form
    while (this.repertoireForm.firstChild) {
      this.repertoireForm.removeChild(this.repertoireForm.lastChild);
    }

    // if we have a suggestion
    if (suggestion) {
      // make sure the suggestion container is visible
      this.showSuggestionContainer();
    } else {
      // hide the suggestion container
      this.hideSuggestionContainer();
    }

    // set the form action to the repertoire color
    this.repertoireForm.action = "./repertoire/" + color;

    var inp = document.createElement("input");
    inp.type = "hidden";
    inp.name = "fen";
    inp.value = fen;

    this.repertoireForm.appendChild(inp);

    if (suggestion) {
      for (var i = 0; i < suggestion.line.length; i++) {
        var inp = document.createElement("input");
        inp.type = "hidden";
        inp.name = "line[]";
        inp.value = suggestion.line[i];

        this.repertoireForm.appendChild(inp);
      }
    }

    this.suggestionField.innerHTML = suggestion
      ? "The move <b>" + suggestion.display + "</b> is not in your repertoire."
      : "";
  }

  /**
   * Practice Info Container functions.
   */

  togglePracticeInfo(eventObject) {

    console.info("togglePracticeInfo", eventObject);
    
    if (
      !this.buttons.showPracticeInfo.disabled &&
      this.buttons.showPracticeInfo.checked
    ) {
      // get the moves & FEN
      var moves =
        this.status == BOARD_STATUS.animatingMoves &&
        this.practice.lineMovesPlayable.length > 0
          ? this.practice.lines[this.practice.lineIdx].line
          : null;
      var fen =
        this.status == BOARD_STATUS.animatingMoves &&
        this.practice.lineMovesPlayable.length > 0
          ? this.practice.lines[this.practice.lineIdx].fen
            ? this.practice.lines[this.practice.lineIdx].fen
            : this.practice.lines[this.practice.lineIdx].before
          : null;

      // update the practice info first
      if (eventObject !== false) {
        this.updatePracticeInfo(moves, fen);

        localStorage.setItem("show-practice-info", true);
      }

      this.practiceInfoContainer.classList.remove("is-hidden");
    } else {
      // update toggle setting
      if (eventObject !== false) {
        localStorage.setItem("show-practice-info", false);
      }

      this.practiceInfoContainer.classList.add("is-hidden");
    }
  }

  /**
   * Analysis functions.
   * - showAnalysis
   * - hideAnalysis
   * - onAnalysisSave
   * - onAnalysisSaveConfirmed
   * - onAnalysisIgnore
   * - onAnalysisIgnoreConfirmed
   * - onAnalysisDiscard
   * - analysisFieldsUpdate
   */

  showAnalysis() {
    // show the analysis container
    this.analysis.buttons.classList.remove("is-hidden");
    this.analysis.container.classList.remove("is-hidden");
    // enable the buttons
    this.analysis.saveButton.disabled = false;
    this.analysis.ignoreButton.disabled = false;
    this.analysis.discardButton.disabled = false;
  }

  hideAnalysis() {
    // hide the analysis container
    this.analysis.buttons.classList.add("is-hidden");
    this.analysis.container.classList.add("is-hidden");
    // disable the buttons
    this.analysis.saveButton.disabled = true;
    this.analysis.ignoreButton.disabled = true;
    this.analysis.discardButton.disabled = true;
  }

  // fired when the analysis save to repertoire button is clicked
  onAnalysisSave(event) {
    // configure the save dialog
    switch (this.practice.lines[this.practice.lineIdx].moves.length) {
      case 1:
        this.analysis.saveDialog.textOneMove.classList.remove("is-hidden");
        this.analysis.saveDialog.textMultipleMoves.classList.add("is-hidden");
        this.analysis.saveDialog.movesList.classList.add("is-hidden");
        break;
      case 2:
        this.analysis.saveDialog.textOneMove.classList.add("is-hidden");
        this.analysis.saveDialog.textMultipleMoves.classList.remove("is-hidden");
        this.analysis.saveDialog.movesList.classList.remove("is-hidden");
        this.analysis.saveDialog.radioTop2.parentNode.parentNode.classList.remove(
          "is-hidden"
        );
        this.analysis.saveDialog.radioTop3.parentNode.parentNode.classList.add(
          "is-hidden"
        );
        break;
      case 3:
        this.analysis.saveDialog.textOneMove.classList.add("is-hidden");
        this.analysis.saveDialog.textMultipleMoves.classList.remove("is-hidden");
        this.analysis.saveDialog.movesList.classList.remove("is-hidden");
        this.analysis.saveDialog.radioTop2.parentNode.parentNode.classList.remove(
          "is-hidden"
        );
        this.analysis.saveDialog.radioTop3.parentNode.parentNode.classList.remove(
          "is-hidden"
        );
        break;
    }

    this.analysis.saveDialog.radioTopMove.checked = true;

    // show the modal
    //Modal.open(this.analysis.saveDialog.modal);
    this.showSaveModal();
  }

  // fired when the save dialog is confirmed
  onAnalysisSaveConfirmed() {
    // get a game with the moves
    var game = this.getCurrentGame();

    // get the moves
    var pgn = "";
    var moves = game.historyWithCorrectFen();

    for (var i = 0; i < moves.length; i++) {
      if (i % 2 == 0) {
        pgn += i / 2 + 1 + ". ";
      }
      pgn += moves[i]["san"];

      moves[i]["pgn"] = pgn;
      moves[i]["autoplay"] = true;

      pgn += " ";
    }

    // add the engine moves
    var addIf = [
      true,
      this.analysis.saveDialog.radioTop2.checked ||
        this.analysis.saveDialog.radioTop3.checked,
      this.analysis.saveDialog.radioTop3.checked,
    ];
    var engineMoves = [];
    for (
      var i = 0;
      i < this.practice.lines[this.practice.lineIdx].moves.length;
      i++
    ) {
      // if we need to add this move
      if (addIf[i]) {
        // make the move
        game.move(this.practice.lines[this.practice.lineIdx].moves[i].move);
        // get the move details
        var last = game.historyWithCorrectFen().pop();
        // set the PGN value
        last["pgn"] = pgn + last["san"];
        // add to the engine moves array
        engineMoves.push(last);
        // undo the move
        game.undo();
      }
    }

    // add the engine moves
    moves.push({ moves: engineMoves });

    // we need to refresh the repertoire data when starting a new practice
    this.needsRefresh = true;

    // set the API url
    var url = "/api/analysis/save";

    // set the data object
    var data = {
      color: this.practice.lines[this.practice.lineIdx].color,
      initialFen: this.practice.lines[this.practice.lineIdx].initialFen,
      fen: this.practice.lines[this.practice.lineIdx].fen,
      move: this.practice.lines[this.practice.lineIdx].move,
      moves: moves,
    };

    // delete the analysis move
    fetch(url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {})
      .catch((error) => {
        console.warn("Error:", error);
        // show the error icon
        Utils.showError();
      });

    // remove from the current practice lines
    this.onAnalysisDiscard(null, false);

    // close the modal
    //Modal.close(this.analysis.saveDialog.modal);
    this.closeSaveModal();
  }

  // get the current game with the moves for this line
  getCurrentGame() {
    // create a new chess game
    var game = new MyChess();
    // get the initial fen
    var initialFen = this.practice.lines[this.practice.lineIdx].initialFen
      ? this.practice.lines[this.practice.lineIdx].initialFen
      : "";
    // reset the game
    if (initialFen != "") {
      game.load(initialFen);
    }

    // play the line moves
    for (
      var i = 0;
      i < this.practice.lines[this.practice.lineIdx].line.length;
      i++
    ) {
      game.move(this.practice.lines[this.practice.lineIdx].line[i]);
    }

    // play the current move (that is the mistake move, don't add this)
    //game.move(this.practice.lines[this.practice.lineIdx].move);

    return game;
  }

  // fired when the analysis ignore button is clicked
  onAnalysisIgnore(event) {
    // show the modal
    //Modal.open(this.analysis.ignoreDialog.modal);
    this.showIgnoreModal();
  }

  // fired when the ignore dialog is confirmed
  onAnalysisIgnoreConfirmed() {
    // set the API url
    var url = "/api/analysis/ignore";
    // set the data
    var data = {
      fen: this.practice.lines[this.practice.lineIdx].fen,
      move: this.practice.lines[this.practice.lineIdx].move,
    };

    // delete the analysis move
    fetch(url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {})
      .catch((error) => {
        console.warn("Error:", error);
        // show the error icon
        Utils.showError();
      });

    // remove from the current practice lines
    this.onAnalysisDiscard(null, false);

    // close the modal
    //Modal.close(this.analysis.ignoreDialog.modal);
    this.showIgnoreModal();
  }

  // fired when the analysis discard button is clicked
  onAnalysisDiscard(event, removeFromDb = true) {
    // we need to refresh the repertoire data when starting a new practice
    this.needsRefresh = true;

    // if we need to remove this move from the database
    if (removeFromDb) {
      //if (false) {
      // set the API url
      var url = "/api/analysis";
      // set the data
      var data = {
        fen: this.practice.lines[this.practice.lineIdx].fen,
        move: this.practice.lines[this.practice.lineIdx].move,
      };

      // delete the analysis move
      fetch(url, {
        method: "DELETE",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((res) => res.json())
        .then((response) => {})
        .catch((error) => {
          console.warn("Error:", error);
          // show the error icon
          Utils.showError();
        });
    }

    // the FEN & move we need to delete
    var fen = this.practice.lines[this.practice.lineIdx].fen;
    var move = this.practice.lines[this.practice.lineIdx].move;

    // reduce by number of moves counter
    var reduceBy = 0;
    var reduceTotal = 0;
    for (var i = 0; i < this.practice.lines.length; i++) {
      // if this is the same move
      if (
        this.practice.lines[i].fen == fen &&
        this.practice.lines[i].move == move
      ) {
        // increase the reduce by counter by the number of moves we're skipping
        reduceBy =
          reduceBy +
          (i == this.practice.lineIdx
            ? this.practice.lineMoves.length -
              this.practice.lineMovesPlayed.length
            : this.practice.lines[i].moves.length);
        reduceTotal = reduceTotal + this.practice.lines[i].moves.length;

        // remove this line
        this.practice.lines.splice(i, 1);

        // adjust the current line index if this line comes before it
        if (i < this.practice.lineIdx) {
          this.practice.lineIdx = this.practice.lineIdx - 1;
          this.practice.skip_lineIdx = this.practice.lineIdx;
        }

        i = i - 1;
      } else if (reduceTotal > 0 && this.practice.lines[i].ourMoveTotal) {
        // we need to reduce the 'ourMoveTotal' values following a deleted line
        this.practice.lines[i].ourMoveTotal =
          this.practice.lines[i].ourMoveTotal - reduceTotal;
      }
    }

    // update the move counter
    if (reduceBy > 0) {
      console.info(
        "-- REDUCEBY",
        reduceBy,
        reduceTotal,
        this.practice.lineMovesPlayed
      );

      this.reduceMoveCount(reduceBy);
    }
    if (reduceTotal > 0) {
      this.practice.moveCount = this.practice.moveCount - reduceTotal;
    }

    // proceed to the 1st move of the next line (current line was removed, so no need to increase line index)
    this.practice.moveIdx = 0;
    this.practice.skip_moveIdx = 0;

    // animate to the next position
    this.practice.animateToPosition = true;
    this.practice.animateFromBeginning = false;

    // remove all markers
    this.board.removeMarkers();
    // remove arrows
    this.board.removeArrows();
    // continue the practice
    this.continuePractice(false);
  }

  // update the analysis game fields
  analysisFieldsUpdate() {
    // safety check
    if (this.practice.lines[this.practice.lineIdx] == undefined) {
      return;
    }

    // set the opponent name
    this.analysis.fields.children[1].innerHTML =
      this.practice.lines[this.practice.lineIdx].color == "white"
        ? this.practice.lines[this.practice.lineIdx].black
        : this.practice.lines[this.practice.lineIdx].white;
    // set the move that was played
    this.analysis.fields.children[3].innerHTML =
      this.practice.lines[this.practice.lineIdx].move +
      " (" +
      this.practice.lines[this.practice.lineIdx].type +
      ")";
    // set the fen
    this.analysis.fields.children[5].innerHTML = this.getFen();
    // set the game link
    this.analysis.fields.children[7].href =
      this.practice.lines[this.practice.lineIdx].link;
    this.analysis.fields.children[7].innerHTML =
      this.practice.lines[this.practice.lineIdx].link;

    /*
    // if we have an initial fen
    if (
      this.practice.lines[this.practice.lineIdx].initialFen &&
      this.practice.lines[this.practice.lineIdx].initialFen != ""
    ) {
      // show the initial fen fields
      this.analysis.fields.children[4].classList.remove("is-hidden");
      this.analysis.fields.children[5].classList.remove("is-hidden");

      // set the initial fen
      this.analysis.fields.children[5].innerHTML =
        this.practice.lines[this.practice.lineIdx].initialFen;
    } else {
      // hide the initial fen fields
      this.analysis.fields.children[4].classList.add("is-hidden");
      this.analysis.fields.children[5].classList.add("is-hidden");
    }
      */
  }

  /**
   * Practice handling functions.
   * - onMoveFinished
   * - pausePractice
   * - continuePractice
   * - gotoNextMove
   * - gotoNextLine
   * - onFinishPractice
   */

  /**
   * Called once a move is finished. If there is only 1 move for a position, it's called after that move
   * is played correctly. If there are multiple correct moves for this position, this function is called once
   * all those moves have been played correctly.
   *
   * Here you decide what to do next:
   * - goto the next move (or line)
   * - pause until the user says to continue
   * - etc
   *
   * @memberof Practice
   */
  onMoveFinished(action = "pause") {
    // currently not waiting on move
    this.practice.waitingOnMove = false;

    // if this is an analysis line
    if (this.type == "analysis") {
      // update the board status
      this.setStatus(BOARD_STATUS.waitingOnMove);

      // wait before proceeding to the next line
      action = "wait";

      // remember the current position
      this.practice.pausedFen = this.game.fen();

      // undo the current move after a short pause (unless the user already continued)
      this.pauseBoard(() => {
        // if still paused
        if (this.practice.paused) {
          // if we still have the same position
          if (
            this.practice.pausedFen == this.game.fen() &&
            this.practice.isMultiple
          ) {
            // undo the last move
            this.gameUndo();
          }

          // remove markers
          this.board.removeMarkers();
          // remove arrows
          this.board.removeArrows();
        }
      }, 1500);
    } else {
      // update the board status
      this.setStatus(BOARD_STATUS.default);
    }

    switch (action) {
      case "continue":
        // continue the practice
        this.continuePractice();
        break;
      case "wait":
        // wait for user interaction before continueing
        this.pausePractice();
        break;
      default:
        // pause for a moment before continueing
        this.pauseBoard(() => {
          // continue the practice
          this.continuePractice();
        }, 1300);
        break;
    }
  }

  // pause the practice
  pausePractice() {
    this.practice.paused = true;

    // set the skip move button text
    //this.buttons.skipMove.innerHTML = "Continue";
    this.buttons.skipMove.title = "Continue";
    // hide the hint (if showing)
    this.hideHint();
    // enable the pgn links
    this.setPgnWithLinks(true);
    // toggle the pgn navigation buttons
    this.togglePgnNavigationButtons();
    // show the pgn navigation buttons
    this.pgnNavigationContainer.classList.remove("is-hidden");

    // allow navigation by arrow left/right
    this.setOption(BOARD_SETTINGS.navigation, true);
  }

  // continue the practice
  continuePractice(gotoNext = true) {
    // if practice was paused
    if (this.practice.paused) {
      // set the skip move button text
      //this.buttons.skipMove.innerHTML = "Skip this move";
      this.buttons.skipMove.title = "Skip this move";
      // disable the pgn links
      this.setPgnWithLinks(false);
      // hide the pgn navigation buttons
      this.pgnNavigationContainer.classList.add("is-hidden");

      // disallow navigation by arrow left/right
      this.setOption(BOARD_SETTINGS.navigation, false);
    }

    this.practice.paused = false;

    // remove markers
    this.removeMarkers();
    // remove arrows
    this.board.removeArrows();

    // goto the next move or line
    if (gotoNext) {
      if (this.practice.isMultiple) {
        this.gotoNextLine(true);
      } else {
        this.gotoNextMove(false);
      }
    } else {
      this.runPractice();
    }
  }

  // goto the next move
  gotoNextMove(animate = false) {
    // goto the next move
    this.practice.moveIdx++;
    this.practice.skip_moveIdx = this.practice.moveIdx;

    this.practice.animateToPosition = animate;
    this.practice.animateFromBeginning = false;

    this.runPractice();
  }

  // goto the next line
  gotoNextLine(animate = true) {
    // goto the next line
    this.practice.lineIdx++;
    this.practice.moveIdx = 0;
    this.practice.skip_lineIdx = this.practice.lineIdx;
    this.practice.skip_moveIdx = this.practice.moveIdx;

    this.practice.animateToPosition = animate;
    this.practice.animateFromBeginning = false;

    this.runPractice();
  }

  // called when a practice is finished, all moves played
  // show info ? toggle buttons, etc..
  onFinishPractice() {}

  /**
   * Repertoire functions:
   * - getRepertoire
   * - onGetRepertoire
   * - showRepertoireType
   * - initRepertoireButtons
   * - toggleRepertoireButtons
   */

  // get the repertoire
  getRepertoire(refresh = this.needsRefresh) {
    // no need to refresh after this
    this.needsRefresh = false;
    // if we need to refresh
    if (refresh) {
      var url = "/api/practice";

      // show the page loader
      Utils.showLoading();

      var data = { id: this.repertoireId };

      fetch(url, {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((res) => res.json())
        .then((response) => {
          // enable the practice
          this.onGetRepertoire(response);
        })
        .catch((error) => {
          console.warn("Error:", error);
          // show the error icon
          Utils.showError();
        })
        .finally(() => {
          // hide the page loader
          Utils.hideLoading();
        });
    } else {
      // enable the practice
      this.onGetRepertoire(this.repertoire);
    }
  }

  // enable the practice
  onGetRepertoire(json, group = null) {
    // store the repertoire
    this.repertoire = json;
    // enable the start practice button
    this.buttons.startPractice.disabled = false;

    // pass the ECO data to the worker
    console.info("-- ECO data set in worker", this.repertoire.eco);
    this.worker.postMessage(["setData", this.repertoire.eco]);

    // get the number of moves (ours) for the different repertoires
    if (this.type != "custom") {
      var moveCounts = ["", "", 0, 0, "", 0];
      this.practice.lines = [];
      moveCounts[2] = this.getPracticeLines("new", this.repertoire["new"]);
      this.practice.lines = [];
      moveCounts[3] = this.getPracticeLines(
        "recommended",
        this.repertoire["recommended"]
      );
      this.practice.lines = [];
      moveCounts[5] = this.getPracticeLines(
        "analysis",
        this.repertoire["analysis"]
      );

      // toggle the repertoire type buttons
      this.toggleRepertoireButtons(moveCounts);

      // load the groups
      if (group == null) {
        this.loadGroups();
      }
    } else {
      // get the moves for the pgn
      var moves =
        this.repertoire["custom"][0]["line"].length > 0
          ? [...this.repertoire["custom"][0]["line"]]
          : [];
      if (
        this.repertoire["custom"][0]["moves"] &&
        this.repertoire["custom"][0]["moves"].length == 1
      ) {
        moves.push(this.repertoire["custom"][0]["moves"][0]["move"]);
      }
      // get the PGN
      var pgn = this.getPgnForMoves(moves);
      // set the custom repertoire field
      this.customRepertoireField.children[0].children[0].innerHTML = pgn;
      // get the ECO code
      console.info("-- get ECO data for custom repertoire");
      this.worker.postMessage(["getEco", pgn, "custom"]);

      // hide the repertoire type buttons
      this.hideRepertoireButtons();
    }

    // get the right repertoire
    var rep =
      this.type == "custom"
        ? this.repertoire["custom"]
        : this.type == "all"
        ? group == null
          ? [...this.repertoire["white"], ...this.repertoire["black"]]
          : this.repertoire.groups[group].lines
        : this.repertoire[this.type];

    this.practice.lines = [];

    // get the practice lines
    this.practice.moveCount = this.getPracticeLines(this.type, rep);

    // show the counters
    this.showCounters(this.practice.moveCount);
  }

  // show a different repertoire type
  showRepertoireType(type) {
    // stop the current practice
    this.stopPractice();
    // set the type
    this.type = type;
    // reset the board
    this.game.reset();
    this.board.setPosition(this.game.fen());
    // remove the markers
    this.board.removeMarkers();
    // remove arrows
    this.board.removeArrows();
    // set the orientation
    var orient = this.type == "black" ? COLOR.black : COLOR.white;
    if (this.board.getOrientation() != orient) {
      this.board.setOrientation(orient);
    }

    // disable move input
    this.disableMoveInput();

    // refresh the repertoire
    this.getRepertoire();
  }

  // add event listeners to the repertoire type buttons
  initRepertoireButtons() {
    this.buttons.repertoireType.children[0].children[0].addEventListener(
      "click",
      (event) => {
        this.showRepertoireType("white");
      }
    );
    this.buttons.repertoireType.children[1].children[0].addEventListener(
      "click",
      (event) => {
        this.showRepertoireType("black");
      }
    );
    this.buttons.repertoireType.children[2].children[0].addEventListener(
      "click",
      (event) => {
        this.showRepertoireType("new");
      }
    );
    this.buttons.repertoireType.children[3].children[0].addEventListener(
      "click",
      (event) => {
        this.showRepertoireType("recommended");
      }
    );
    this.buttons.repertoireType.children[4].children[0].addEventListener(
      "click",
      (event) => {
        this.showRepertoireType("all");
      }
    );
    this.buttons.repertoireType.children[5].children[0].addEventListener(
      "click",
      (event) => {
        this.showRepertoireType("analysis");
      }
    );
  }

  // hide the repertoire buttons
  hideRepertoireButtons() {
    // hide  the repertoire type buttons
    this.buttons.repertoireType.classList.add("is-hidden");
    // show the custom repertoire field
    this.customRepertoireField.classList.remove("is-hidden");

    // hide the groups
    this.hideGroups();
  }

  // toggle the repertoire type buttons
  toggleRepertoireButtons(moveCounts) {
    // toggle the repertoire type buttons
    this.buttons.repertoireType.children[0].children[0].disabled =
      this.repertoire.white.length == 0;
    this.buttons.repertoireType.children[1].children[0].disabled =
      this.repertoire.black.length == 0;
    this.buttons.repertoireType.children[2].children[0].disabled =
      this.repertoire.new.length == 0;
    if (this.repertoire.new.length == 0) {
      this.buttons.repertoireType.children[2].classList.add("is-hidden");
    } else {
      this.buttons.repertoireType.children[2].classList.remove("is-hidden");
    }
    this.buttons.repertoireType.children[3].children[0].disabled =
      this.repertoire.recommended.length == 0;
    if (this.repertoire.recommended.length == 0) {
      this.buttons.repertoireType.children[3].classList.add("is-hidden");
    } else {
      this.buttons.repertoireType.children[3].classList.remove("is-hidden");
    }
    this.buttons.repertoireType.children[4].children[0].disabled =
      this.repertoire.white.length == 0 && this.repertoire.black.length == 0;
    this.buttons.repertoireType.children[5].children[0].disabled =
      this.repertoire.analysis.length == 0;

    this.buttons.repertoireType.children[2].children[2].children[0].innerHTML =
      moveCounts[2];
    this.buttons.repertoireType.children[3].children[2].children[0].innerHTML =
      moveCounts[3];
    this.buttons.repertoireType.children[5].children[2].children[0].innerHTML =
      moveCounts[5];

    // select the right type
    var idx = this.types.indexOf(this.type);
    // set to "all" if there are no practice lines for this type
    if (
      idx == -1 ||
      this.buttons.repertoireType.children[idx].children[0].disabled
    ) {
      // check the checkbox
      this.buttons.repertoireType.children[4].children[0].checked = true;
    }

    // toggle the group select container
    if (
      this.buttons.repertoireType.children[4].children[0].checked &&
      this.repertoire.groups.length > 0
    ) {
      this.showGroups();
    } else {
      this.hideGroups();
    }
  }

  /**
   * Repertoire group functions. Select box with repertoire groups to practice.
   *
   * - loadGroups
   * - showGroups
   * - hideGroups
   */

  loadGroups() {
    // clear the moves list
    while (this.containers.groupSelect.lastChild) {
      this.containers.groupSelect.removeChild(
        this.containers.groupSelect.firstChild
      );
    }

    var opt = document.createElement("option");
    opt.value = "";
    opt.text =
      this.repertoire.groups.length == 0
        ? "No groups available"
        : "No group selected";

    this.containers.groupSelect.appendChild(opt);

    var groupsSorted = [];

    for (var i = 0; i < this.repertoire.groups.length; i++) {
      groupsSorted.push({ id: i, name: this.repertoire.groups[i].name });
    }

    groupsSorted.sort((a, b) => {
      if (a.name === b.name) return 0;
      return a.name > b.name ? 1 : -1;
    });

    for (var i = 0; i < groupsSorted.length; i++) {
      opt = document.createElement("option");
      opt.value = groupsSorted[i].id;
      opt.text = groupsSorted[i].name;

      this.containers.groupSelect.appendChild(opt);
    }
  }

  showGroups() {
    this.containers.group.classList.remove("is-hidden");
  }

  hideGroups() {
    this.containers.group.classList.add("is-hidden");
  }

  onGroupSelectChange(event) {
    // stop the current practice
    this.stopPractice();
    // reset the board
    this.game.reset();
    this.board.setPosition(this.game.fen());
    // remove the markers
    this.board.removeMarkers();
    // remove arrows
    this.board.removeArrows();
    // disable move input
    this.disableMoveInput();

    // get the group repertoire
    this.onGetRepertoire(
      this.repertoire,
      this.containers.groupSelect.value == ""
        ? null
        : this.containers.groupSelect.value
    );
  }

  // split the repertoire into practice lines
  getPracticeLines(
    type,
    lines,
    color = "",
    ourMove = false,
    lineMoves = [],
    add = true,
    isVariation = false,
    depth = 0,
    ourMoveTotalSoFar = 0
  ) {
    // keep track of how many moves there are for us
    var ourMoveTotal = 0;

    for (var i = 0; i < lines.length; i++) {
      // if a color is given
      if (color != "") {
        lines[i].color = color;
        lines[i].line = lineMoves;
      } else {
        lineMoves = [...lines[i].line];
      }

      //
      if (depth == 0) {
        ourMove =
          (lines[i].color == "white" && lines[i].line.length % 2 == 0) ||
          (lines[i].color == "black" && lines[i].line.length % 2 == 1);
      }

      var playableCnt = 0;
      if (ourMove) {
        for (var x = 0; x < lines[i].moves.length; x++) {
          if (!lines[i].moves[x].autoplay) {
            playableCnt++;
          }
        }
      }

      // the total moves for this line
      var lineMoveTotal = ourMove ? playableCnt : 0;

      // make a copy of the line
      var copy = lines.slice(i, i + 1)[0];

      var addedIdx = -1;

      // if we need to add this line
      if (add && lines[i].moves.length > 0) {
        // if this is a variation
        if (isVariation) {
          //lines[i].variation = true;
          copy.variation = true;
        }

        copy["ourMoveTotal"] = ourMoveTotalSoFar + ourMoveTotal;

        // add the practice line
        //this.practice.lines.push(lines[i]);
        addedIdx = this.practice.lines.push(copy) - 1;
      }

      // if this line has moves that follow
      if (type != "analysis" && lines[i].moves.length > 0) {
        // add this move to the line moves array
        var line = [...lineMoves];
        if (lines[i].move) {
          line.push(lines[i].move);
        }

        // get the practice lines
        var sub = this.getPracticeLines(
          type,
          lines[i].moves,
          lines[i].color != "" ? lines[i].color : color,
          !ourMove,
          line,
          lines[i].moves.length > 1,
          true,
          depth + 1,
          ourMoveTotalSoFar + ourMoveTotal + lineMoveTotal
        );

        // if these are not split lines, include the total our moves
        if (lines[i].moves.length == 1) {
          lineMoveTotal += sub;
        } else {
          ourMoveTotal += sub;
        }
      }

      if (addedIdx > -1) {
        this.practice.lines[addedIdx]["ourMoves"] = lineMoveTotal;
      }

      ourMoveTotal += lineMoveTotal;
    }

    return ourMoveTotal;
  }

  /**
   * Practice functions.
   * - onStartPractice
   * - stopPractice
   * - runPractice
   */

  // start the practice
  async onStartPractice() {

    console.log("-- START PRACTICE", this.practice.lines);

    // reset vars
    this.practice.moveNr = 1;
    this.practice.lineIdx = 0;
    this.practice.moveIdx = 0;
    this.practice.skip_lineIdx = 0;
    this.practice.skip_moveIdx = 0;
    this.practice.skipCount = 0;
    this.practice.lineColor = "";
    this.practice.lineMoves = [];
    this.practice.lineMovesMultiple = [];
    this.practice.lineMovesPlayed = [];
    this.practice.initialFen = "";
    this.practice.currentFen = "";
    this.practice.isRunning = false;
    this.practice.isInterrupted = false;
    this.practice.stopAnimating = false;
    this.practice.paused = false;
    this.practice.pausedFen = "";

    // set the skip move button text
    //this.buttons.skipMove.innerHTML = "Skip this move";
    this.buttons.skipMove.title = "Skip this move";

    // toggle the buttons
    this.buttons.startPractice.disabled = true;
    this.buttons.startPractice.classList.add("is-hidden");
    this.buttons.giveHint.disabled = false;
    this.buttons.giveHint.classList.remove("is-hidden");
    this.buttons.prevMove.disabled = true;
    this.buttons.prevMove.classList.remove("is-hidden");
    this.buttons.skipMove.disabled = false;
    this.buttons.skipMove.classList.remove("is-hidden");

    if (this.type == "analysis") {
      this.buttons.showPracticeInfo.disabled = true;
      this.buttons.showPracticeInfo.nextElementSibling.classList.add("is-hidden");

      this.practiceInfoContainer.classList.add("is-hidden");
    } else {
      this.buttons.showPracticeInfo.disabled = false;
      this.buttons.showPracticeInfo.nextElementSibling.classList.remove(
        "hidden"
      );

      // get the show info setting
      var showPracticeInfo = localStorage.getItem("show-practice-info");
      // toggle the checked state
      this.buttons.showPracticeInfo.checked = showPracticeInfo === "true";

      this.togglePracticeInfo(false);
    }

    // reset the counters
    this.showCounters(this.practice.moveCount);

    // enable board move input
    this.disableMoveInput();
    this.enableMoveInput();

    // toggle the analysis container
    if (this.type == "analysis") {
      // show the proper containers
      this.showPgnContainer();
      //this.showSuggestionContainer();
      this.showAnalysis();
    }

    // animate to starting position
    this.practice.animateToPosition = true;
    this.practice.animateFromBeginning = false;

    // run the practice
    this.runPractice();

    return;
  }

  // stop a practice (when switching type)
  stopPractice() {
    // toggle the buttons
    this.buttons.startPractice.disabled = false;
    this.buttons.startPractice.innerHTML = "Start your practice";
    this.buttons.startPractice.classList.remove("is-hidden");
    this.buttons.giveHint.disabled = true;
    this.buttons.giveHint.classList.add("is-hidden");
    this.buttons.prevMove.disabled = true;
    this.buttons.prevMove.classList.add("is-hidden");
    this.buttons.skipMove.disabled = true;
    this.buttons.skipMove.classList.add("is-hidden");
    this.buttons.showPracticeInfo.disabled = true;
    this.buttons.showPracticeInfo.nextElementSibling.classList.add("is-hidden");

    this.togglePracticeInfo(false);

    // stop animating
    this.practice.stopAnimating = true;

    // reset the game & board
    this.game.reset();
    this.board.setPosition(this.game.fen());

    // hide the played moves container
    this.hidePlayedMoves();

    // toggle the analysis container
    if (this.type == "analysis") {
      // hide the proper containers
      this.hidePgnContainer();
      this.hideSuggestionContainer();
      this.hideAnalysis();
    }

    // show info
    this.showInfo("To start your practice, click the button below.");
  }

  // update the practice info container fields
  updatePracticeInfo(moves = null, fen = null) {
    // only update the fields if visible
    if (!this.buttons.showPracticeInfo.checked) {
      return false;
    }

    // get the PGN & FEN
    var pgn = moves == null ? this.game.pgn() : this.getPgnForMoves(moves);
    fen = fen == null ? this.getFen() : fen;

    // get the FEN parts to determine who's turn it is
    var parts = fen.split(" ");
    // if this is not our move, don't update..
    if (
      parts[1] !== this.practice.lines[this.practice.lineIdx].color.substr(0, 1)
    ) {
      return false;
    }

    // if the same PGN as currently showing
    if (this.practiceInfoFields.children[3].innerHTML == pgn) {
      return false;
    }

    // if the board is animating moves
    if (this.status == BOARD_STATUS.animatingMoves && moves == null) {
      return false;
    }

    // update the info fields
    this.practiceInfoFields.children[1].innerHTML = "";
    this.practiceInfoFields.children[3].innerHTML = pgn;
    this.practiceInfoFields.children[5].innerHTML = fen;

    // update the stats
    this.updatePracticeInfoStats();

    // if we have moves
    if (pgn != "") {
      // update the ECO field
      console.log("-- GET ECO FOR", pgn);
      this.worker.postMessage(["getEco", pgn]);
    }
  }

  updatePracticeInfoStats() {
    var temp = this.practice.lines[this.practice.lineIdx];
    if (this.type != "analysis") {
      for (var i = 0; i < this.practice.moveIdx; i++) {
        temp = temp.moves[0];
      }
    }

    // get the playable moves (not the autoplay moves)
    var practiceCount = 0;
    var practiceFailed = 0;
    var practiceInARow = 0;
    var count = 0;
    for (var i = 0; i < temp.moves.length; i++) {
      if (!temp.moves[i].autoplay) {
        practiceCount += temp.moves[i].practiceCount
          ? temp.moves[i].practiceCount
          : 0;
        practiceFailed += temp.moves[i].practiceFailed
          ? temp.moves[i].practiceFailed
          : 0;
        practiceInARow += temp.moves[i].practiceInARow
          ? temp.moves[i].practiceInARow
          : 0;
        count++;
      }
    }

    practiceInARow = Math.round(practiceInARow / Math.max(1, count));

    var pct =
      practiceCount == 0
        ? 100
        : 100 - Math.round((practiceFailed / practiceCount) * 100);

    var colors = [
      "is-danger",
      "is-warning",
      "is-warning",
      "is-success",
    ];

    // get the accuracy index for the colors
    var accuracyIdx = Math.max(0, Math.ceil(pct / 25) - 1);
    // get the accuracy in a row (based on 0-7 scale)
    var accuracyInARowIdx = Math.floor(Math.min(7, practiceInARow) / 2);

    var stats =
      '<span class="tag ' +
      colors[accuracyIdx] +
      '">';
    stats +=
      practiceCount == 0
        ? "first attempt"
        : pct +
          "% over " +
          Utils.getAbbreviatedNumber(practiceCount) +
          " attempt" +
          (practiceCount > 1 ? "s" : "");
    stats += "</span>";

    // if the accuracy in a row differs
    if (practiceCount > 10 && accuracyInARowIdx > accuracyIdx) {
      // show the accuracy in a row
      stats +=
        ' <span class="tag ' +
        colors[accuracyInARowIdx] +
        '">';
      stats += practiceInARow + " in a row</span>";
    }

    // update the stats
    this.practiceInfoFields.children[7].innerHTML = stats;
  }

  getPgnForMoves(moves) {
    var pgn = "";
    for (var i = 0; i < moves.length; i++) {
      var moveNr = Math.floor(i / 2) + 1;

      if (i % 2 == 0) {
        pgn += (moveNr > 1 ? " " : "") + moveNr + ".";
      }

      //pgn += " " + moves[i].san;
      pgn += " " + moves[i];
    }

    return pgn;
  }

  // show the confetti
  showConfetti() {
    this.confettiFire(0.25, {
      spread: 26,
      startVelocity: 55,
    });
    this.confettiFire(0.2, {
      spread: 60,
    });
    this.confettiFire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
    });
    this.confettiFire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
    });
    this.confettiFire(0.1, {
      spread: 120,
      startVelocity: 45,
    });
  }

  confettiFire(particleRatio, opts) {
    var count = 200;
    var defaults = {
      origin: { y: 0.7 },
    };

    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  }

  // run the practice
  async runPractice(
    _lineIdx = this.practice.lineIdx,
    _moveIdx = this.practice.moveIdx
  ) {
    //await this.waitForAnimationFinish();
    await this.interruptPractice();

    // this function is running
    this.practice.isRunning = true;
    this.practice.isInterrupted = false;

    this.buttons.prevMove.disabled = _lineIdx == 0 && _moveIdx == 0;

    // hide the hint (if showing)
    this.hideHint();

    // remove markers
    this.removeMarkers();
    // remove arrows
    this.board.removeArrows();

    // if we've completed all lines
    if (this.practice.lineIdx >= this.practice.lines.length) {
      // stop the current practice
      this.stopPractice();
      // update the status
      this.showInfo("You have completed all the lines in this repertoire.");
      // set the button text
      this.buttons.startPractice.innerHTML = "Start again";

      // this function is no longer running
      this.practice.isRunning = false;

      // if no mistakes, show confetti
      if (
        parseInt(this.containers.correctCounter.innerHTML) > 0 &&
        parseInt(this.containers.failedCounter.innerHTML) == 0
      ) {
        //this.showConfetti();
      }

      return;
    }

    // if the line color changed, we need to reset the board
    var colorChanged =
      this.practice.lineColor !=
      this.practice.lines[this.practice.lineIdx].color;

    // get the line color
    this.practice.lineColor = this.practice.lines[this.practice.lineIdx].color;

    // get the next moves
    var next = this.getMoves();

    // if no more moves or next move for analysis line..
    if (
      (!this.isAutoMove() && next.playable.length == 0) ||
      (this.type == "analysis" && this.practice.moveIdx > 0)
    ) {
      // goto the next line
      this.gotoNextLine(true);

      // this function is no longer running
      this.practice.isRunning = false;

      return;
    }

    // set the practice line vars
    this.practice.isMultiple = next.moves.length > 1;
    this.practice.lineMoves = next.moves;
    this.practice.lineMovesMultiple = next.multiple;
    this.practice.lineMovesPlayable = next.playable;
    this.practice.lineMovesPlayed = [];
    this.practice.failedCount = 0;

    // reset the hint counter
    this.hintCounter = 0;
    // currently waiting on move
    this.practice.waitingOnMove = true;
    // disable the pgn links
    this.setPgnWithLinks(false);
    // hide the pgn navigation buttons
    this.pgnNavigationContainer.classList.add("is-hidden");

    // disallow navigation by arrow left/right
    this.setOption(BOARD_SETTINGS.navigation, false);

    // recalibrate the move counter (in case of fast skipping errors)
    if (
      this.practice.moveIdx == 0 &&
      this.practice.lineIdx == _lineIdx &&
      this.practice.moveIdx == _moveIdx
    ) {
      this.containers.moveCounter.innerHTML =
        this.practice.moveCount - next.ourMoveCountSoFar;
    }

    // if this is the 1st move in the line
    if (this.practice.moveIdx == 0 || this.practice.animateToPosition) {
      // update the board status
      this.setStatus(BOARD_STATUS.animatingMoves);
      // set the orientation of the board
      var orient =
        this.practice.lineColor == "white" ? COLOR.white : COLOR.black;
      if (this.board.getOrientation() != orient) {
        // reset the game & update the board
        this.game.reset();
        this.board.setPosition(this.game.fen(), false);
        // flip the board
        this.board.setOrientation(orient);
      }

      // if we have moves to make to get to our position
      if (
        this.type == "analysis" ||
        //this.practice.lines[this.practice.lineIdx].line.length > 0 ||
        next.line.length > 0 ||
        this.practice.lines[this.practice.lineIdx].variation ||
        (this.practice.lines[this.practice.lineIdx].initialFen &&
          this.practice.lines[this.practice.lineIdx].initialFen != "")
      ) {
        // if we have moves to make to get to this line
        if (this.type == "analysis" || this.practice.animateToPosition) {
          // get the initial fen
          var initialFen = this.practice.lines[this.practice.lineIdx].initialFen
            ? this.practice.lines[this.practice.lineIdx].initialFen
            : "";

          // reset the game if the initial FEN is different or if we need to animate to the position
          if (
            initialFen != this.practice.initialFen ||
            this.practice.animateFromBeginning
          ) {
            // reset the game
            if (initialFen != "") {
              this.game.load(initialFen);
            } else {
              this.game.reset();
            }
            // update the board
            //this.board.setPosition(this.game.fen());
          }

          // reset to the new position (and get the moves we need to make on the board)
          var boardMoves = await this.resetToPosition(
            initialFen,
            next.line,
            this.settings.animate_variation == 1, // resetMoves = animate from start of line vs start of variation
            false // do not update the board
          );

          // if this line is a variation we need to make this move also (used for new line or for prev)
          if (
            (this.practice.lines[this.practice.lineIdx].variation ||
              this.practice.animateFromBeginning) &&
            this.type != "analysis"
          ) {
            // make the 1st move of the variation, that was the point we left off
            if (next.move) {
              //this.game.move(this.practice.lines[this.practice.lineIdx].move);
              this.game.move(next.move);
              boardMoves.push(this.game.history({ verbose: true }).pop());
            }
          }

          // reset to current game
          this.resetToCurrent(initialFen);

          // if the next move is a playable move
          if (
            this.practice.lineMovesPlayable.length > 0 &&
            (!this.practice.lines[this.practice.lineIdx].variation ||
              this.type == "analysis")
          ) {
            // update the practice info
            this.updatePracticeInfo(
              this.practice.lines[this.practice.lineIdx].line,
              this.practice.lines[this.practice.lineIdx].fen
                ? this.practice.lines[this.practice.lineIdx].fen
                : this.practice.lines[this.practice.lineIdx].before
            );
          }

          // animate to this position
          if (this.type == "analysis") {
            // if there are any moves
            //if (history.length > 0) {
            if (boardMoves.length > 0) {
              // undo the last move
              var last = boardMoves.pop();

              // update the board
              await this.board.setPosition(last.before, true);

              // pauseBoard
              // animate the last move
              await this.animateMoves(_lineIdx, _moveIdx, [last]);
            }
          } else {
            // update the board
            if (boardMoves.length > 0) {
              await this.board.setPosition(boardMoves[0].before, false);
            }

            //await this.animateMoves(history);
            await this.animateMoves(_lineIdx, _moveIdx, boardMoves);
          }

          // update the board (in case of interruption)
          this.board.setPosition(this.game.fen());

          // enable board move input
          //this.enableMoveInput();
        } else if (this.practice.lines[this.practice.lineIdx].variation) {
          try {
            // make the 1st move of the variation, that was the point we left off
            this.game.move(this.practice.lines[this.practice.lineIdx].move);
            // get the last move
            var last = this.game.history({ verbose: true }).pop();

            // animate the move
            await this.board.movePiece(last.from, last.to, true);

            // update the board (in case of castling)
            this.board.setPosition(this.game.fen());
          } catch (err) {
            console.warn("Error:", err);
          }
        }

        // update the board status
        this.setStatus(BOARD_STATUS.default);

        // if this is an analysis line
        if (this.type == "analysis") {
          // update the suggestion field
          this.updateSuggestionField(
            this.practice.lineColor,
            this.practice.lines[this.practice.lineIdx].initialFen,
            this.practice.lines[this.practice.lineIdx].suggestion
          );
          // update the analysis game fields
          this.analysisFieldsUpdate();
        }
      } else {
        // if we need to switch the board
        if (colorChanged) {
          // reset the game & board
          this.game.reset();
          this.board.setPosition(this.game.fen());
        }

        // if the FEN does not match (in case of groups)
        if (this.getFen() !== this.practice.lines[this.practice.lineIdx].fen) {
          // load the correct FEN
          this.game.load(this.practice.lines[this.practice.lineIdx].fen);

          // update the board
          await this.board.setPosition(
            this.practice.lines[this.practice.lineIdx].fen,
            true
          );
        }
      }
    }

    // make sure we are still on the same line (skipping, etc)
    if (
      _lineIdx != this.practice.lineIdx ||
      _moveIdx != this.practice.moveIdx
    ) {
      // this function is no longer running
      this.practice.isRunning = false;

      return false;
    }

    // remember the current move number
    this.practice.moveNr = this.game.history().length + 1;

    // if the user needs to make a move
    if (!this.isAutoMove()) {
      // if we have multiple moves
      if (next.moves.length > 1 || next.multiple.length > 1) {
        // update the status
        //if (moves.length < multiple.length) {
        if (next.playable.length < next.multiple.length) {
          this.showInfo(
            "You have " +
              (next.multiple.length - next.playable.length) +
              " more move" +
              (next.multiple.length - next.playable.length > 1 ? "s" : "") +
              " in your repertoire here."
          );
        } else {
          // update the status
          if (this.type == "analysis") {
            this.showInfo(
              "You played the move <b>" +
                this.practice.lines[this.practice.lineIdx].move +
                "</b>, which is " +
                (this.practice.lines[this.practice.lineIdx].type == "inaccuracy"
                  ? "an"
                  : "a") +
                " " +
                this.practice.lines[this.practice.lineIdx].type +
                ". There are " +
                next.moves.length +
                " good moves here."
            );
          } else {
            this.showInfo(
              "You have " +
                next.moves.length +
                " moves in your repertoire here."
            );
          }
        }

        // show the played moves container
        this.showPlayedMoves(next.multiple.length);

        // if we need to add moves to already played moves
        //if (moves.length < multiple.length) {
        if (next.playable.length < next.multiple.length) {
          for (var i = 0; i < next.multiple.length; i++) {
            if (!next.playable.includes(next.multiple[i].move)) {
              // add the move to the played moves list
              this.setPlayedMove(
                this.practice.lineMovesPlayed.length,
                next.multiple[i].move,
                next.multiple[i].cp,
                next.multiple[i].mate,
                next.multiple[i].pv
              );
              this.practice.lineMovesPlayed.push(next.multiple[i].move);
            }
          }
        }
      } else {
        // update the status
        if (this.type == "analysis") {
          this.showInfo(
            "You played the move <b>" +
              this.practice.lines[this.practice.lineIdx].move +
              "</b>, which is " +
              (this.practice.lines[this.practice.lineIdx].type == "inaccuracy"
                ? "an"
                : "a") +
              " " +
              this.practice.lines[this.practice.lineIdx].type +
              ". Try to find the best move."
          );
          // show the played moves container
          this.showPlayedMoves(1);
        } else if (next.playable.length > 0) {
          this.showInfo("Play the move that's in your repertoire.");

          // hide the played moves
          this.hidePlayedMoves();
        }
      }
    }

    // remember the current FEN position
    this.practice.currentFen = this.game.fen();

    // this function is no longer running
    this.practice.isRunning = false;

    // if not interrupted
    if (
      _lineIdx == this.practice.lineIdx &&
      _moveIdx == this.practice.moveIdx &&
      !(this.practice.stopAnimating || this.practice.isInterrupted)
    ) {
      // wait on the next move
      this.waitOnMove();
    }
  }

  // get the moves for a certain line/move
  getMoves() {
    var moves = [];
    var playable = [];

    var temp = this.practice.lines[this.practice.lineIdx];
    if (this.type != "analysis") {
      for (var i = 0; i < this.practice.moveIdx; i++) {
        temp = temp.moves[0];
      }
    }

    // get the moves (if any)
    if (temp.moves) {
      for (var i = 0; i < temp.moves.length; i++) {
        moves.push(temp.moves[i]["move"]);
      }

      // get the playable moves (not the autoplay moves)
      for (var i = 0; i < temp.moves.length; i++) {
        if (!temp.moves[i].autoplay) {
          playable.push(temp.moves[i].move);
        }
      }
    }

    return {
      move: temp.move,
      moves: moves,
      multiple: temp.multiple,
      playable: playable,
      line: temp.line,
      ourMoveCountSoFar: temp.ourMoveTotal ? temp.ourMoveTotal : 0,
    };
  }

  // wait on next move (use auto-play if needed)
  waitOnMove() {
    // if we need to auto-move
    if (this.isAutoMove()) {
      // auto-move (for other color)
      this.autoMove();
    } else {
      // update the board status
      this.setStatus(BOARD_STATUS.waitingOnMove);

      // add last move markers
      this.afterMakeMove(false);

      // update the practice info
      setTimeout(() => {
        this.updatePracticeInfo();
      }, 1);

      // if we need to add markers for moves that do not need to be played
      if (
        (this.practice.lineMoves.length > 1 ||
          this.practice.lineMovesMultiple.length > 1) &&
        this.practice.lineMovesPlayable.length <
          this.practice.lineMovesMultiple.length
      ) {
        for (var i = 0; i < this.practice.lineMovesMultiple.length; i++) {
          if (
            !this.practice.lineMovesPlayable.includes(
              this.practice.lineMovesMultiple[i].move
            )
          ) {
            try {
              // get the from & to squares for this move
              this.game.move(this.practice.lineMovesMultiple[i].move);
              var last = this.game.history({ verbose: true }).pop();
              this.game.undo();

              // add markers for the move we don't need (so the user can see)
              //this.board.addMarker(MARKER_TYPE.circle, last.from);
              //this.board.addMarker(MARKER_TYPE.circle, last.to);
              // add an arrow for the move we don't need (so the user can see)
              this.board.addArrow(CUSTOM_ARROW_TYPE.normal, last.from, last.to);
            } catch (err) {
              console.warn(err);
            }
          }
        }
      }
      // if this is an analysis line
      if (this.type == "analysis") {
        // make the move that was played (the mistake)
        this.game.move(this.practice.lines[this.practice.lineIdx].move);
        // get the last move
        var last = this.game.history({ verbose: true }).pop();
        // undo the move
        this.game.undo();
        // mark the move that was played
        this.board.addMarker(CUSTOM_MARKER_TYPE.squareRed, last.from);
        this.board.addMarker(CUSTOM_MARKER_TYPE.squareRed, last.to);
      }
    }
  }

  // do we need to auto-move?
  isAutoMove() {
    return (
      (this.practice.lineColor == "white" && this.game.turn() == "b") ||
      (this.practice.lineColor == "black" && this.game.turn() == "w") ||
      (this.practice.lineMoves.length == 1 &&
        this.practice.lineMovesPlayable.length == 0)
    );
  }

  // auto-move
  async autoMove(next = false) {
    // if we have multiple moves or this is an analysis line
    if (this.practice.isMultiple || this.type == "analysis") {
      // goto the next line
      this.gotoNextLine();

      return;
    }

    if (next) {
      // goto the next move
      this.practice.moveIdx++;
      this.practice.skip_moveIdx = this.practice.moveIdx;
    }

    // get the next moves
    //var [moves, multiple, playable] = this.getMoves();
    var next = this.getMoves();

    // if any moves to play
    if (next.moves.length > 0) {
      // make the move
      this.game.move(next.moves[0]);
      // get the last move
      var last = this.game.history({ verbose: true }).pop();

      // animate the move
      await this.board.movePiece(last.from, last.to, true);

      // update the board (in case of castling)
      this.board.setPosition(this.game.fen());

      // if we have multiple moves from here
      if (next.moves.length > 1) {
        // goto the next line
        this.gotoNextLine(false);
      } else {
        // goto the next move
        this.gotoNextMove(false);
      }
    } else {
      // goto the next line
      this.gotoNextLine(true);
    }

    return;
  }

  // disables the board for a short time and then executes a function
  pauseBoard(func, ms = 800) {
    // disable the board
    //this.disableMoveInput();

    // update the board status
    this.setStatus(BOARD_STATUS.default);

    setTimeout(() => {
      // enable move input
      //this.enableMoveInput();

      // execute the function
      func();
    }, ms);
  }

  // called when the correct move was played
  correctMovePlayed() {
    var cp = null;
    var mate = null;
    var pv = null;

    for (var i = 0; i < this.practice.lineMovesMultiple.length; i++) {
      if (this.practice.lineMovesMultiple[i].move == this.lastMove.san) {
        cp = this.practice.lineMovesMultiple[i].cp;
        mate = this.practice.lineMovesMultiple[i].mate;
        pv = this.practice.lineMovesMultiple[i].pv;
        break;
      }
    }

    // if we have multiple correct moves
    if (this.practice.isMultiple) {
      // if this move was already played
      if (this.practice.lineMovesPlayed.includes(this.lastMove.san)) {
        // update status
        this.showInfo(
          "You already played this move. Try to find the next move."
        );

        // pause the board for a moment
        this.pauseBoard(() => {
          // undo the last move
          //this.game.undo();
          //this.board.setPosition(this.game.fen());
          this.gameUndo();
          // remove markers
          this.board.removeMarkers();
          // remove arrows
          this.board.removeArrows();
          // update the board status
          this.setStatus(BOARD_STATUS.waitingOnMove);
        });

        return;
      }

      // add the move to the correctly played moves
      this.practice.lineMovesPlayed.push(this.lastMove.san);

      // show the played move in the list
      this.setPlayedMove(
        this.type == "analysis"
          ? this.practice.lineMoves.indexOf(this.lastMove.san)
          : this.practice.lineMovesPlayed.length - 1,
        this.lastMove.san,
        cp,
        mate,
        pv
      );

      // update the move counter
      this.reduceMoveCount();

      // only add to the correct counter if we haven't failed the move
      if (
        this.practice.failedCount + this.practice.lineMovesPlayed.length <=
        this.practice.lineMoves.length
      ) {
        this.addCorrectCount();
      }

      // update the counters for this move
      this.saveMoveCounters([
        {
          color: this.practice.lineColor,
          fen: this.lastMove.before,
          move: this.lastMove.san,
          correct: 1,
        },
      ]);

      // set the confirm message
      var nth = ["", "2nd ", "3rd "];
      var msg =
        this.type == "analysis"
          ? "That is the " +
            nth[this.practice.lineMoves.indexOf(this.lastMove.san)] +
            "best move."
          : "That's the correct move.";

      // if all correct moves have been played
      if (
        this.practice.lineMovesPlayed.length ==
        this.practice.lineMovesMultiple.length
      ) {
        // update the status
        this.showConfirm(msg);
        this.onMoveFinished();
      } else {
        // update the status
        this.showConfirm(msg + " Try to find the next move.");

        // pause the board for a moment
        this.pauseBoard(() => {
          // undo the last move
          this.gameUndo();
          // remove markers
          this.board.removeMarkers();
          // remove arrows
          this.board.removeArrows();
          // wait on the next move
          this.waitOnMove();
        }, 1200);
      }
    } else {
      // update the status
      this.showConfirm("That's the correct move.");

      // update the move counter
      this.reduceMoveCount();

      // add the move to the correctly played moves
      this.practice.lineMovesPlayed.push(this.lastMove.san);

      // if we have multiples here or this is an analysis line
      if (
        this.type == "analysis" ||
        this.practice.lineMovesMultiple.length > 1
      ) {
        // show the played move in the list
        this.setPlayedMove(
          this.practice.lineMovesPlayed.length - 1,
          this.lastMove.san,
          cp,
          mate,
          pv
        );
      }

      // if we didn't fail this move
      if (this.practice.failedCount == 0) {
        // update the correct counter
        this.addCorrectCount();
      }

      // update the counters for this move
      this.saveMoveCounters([
        {
          color: this.practice.lineColor,
          fen: this.lastMove.before,
          move: this.lastMove.san,
          correct: 1,
        },
      ]);

      this.onMoveFinished();
    }
  }

  interruptPractice(timeout = 2000) {
    if (this.practice.isRunning == false) {
      return new Promise(function (resolve, reject) {
        resolve(true);
      });
    }

    this.practice.isInterrupted = true;
    this.practice.stopAnimating = true;

    var start = Date.now();
    return new Promise(waitForPractice.bind(this)); // set the promise object within the ensureFooIsSet object

    function waitForPractice(resolve, reject) {
      if (this.practice.isRunning == false) {
        resolve(true);
      } else if (timeout && Date.now() - start >= timeout) {
        //reject(new Error("timeout"));
        // dont want to throw an error, just try to continue anyway
        resolve(false);
      } else {
        setTimeout(waitForPractice.bind(this, resolve, reject), 30);
      }
    }
  }

  waitForAnimationFinish(timeout = 2000) {
    if (this.status !== BOARD_STATUS.animatingMoves) {
      return new Promise(function (resolve, reject) {
        resolve(true);
      });
    }

    var start = Date.now();
    return new Promise(waitForAnimation.bind(this)); // set the promise object within the ensureFooIsSet object

    // waitForFoo makes the decision whether the condition is met
    // or not met or the timeout has been exceeded which means
    // this promise will be rejected
    function waitForAnimation(resolve, reject) {
      if (this.status !== BOARD_STATUS.animatingMoves) {
        resolve(true);
      } else if (timeout && Date.now() - start >= timeout) {
        //reject(new Error("timeout"));
        // dont want to throw an error, just try to continue anyway
        resolve(false);
      } else {
        setTimeout(waitForAnimation.bind(this, resolve, reject), 30);
      }
    }
  }

  // animate the moves 1 by 1
  async animateMoves(_lineIdx, _moveIdx, moves, lastOnly = false) {
    // if we need to ignore this animation
    if (
      _lineIdx != this.practice.lineIdx ||
      _moveIdx != this.practice.moveIdx
    ) {
      return false;
    }

    // reset stop animating boolean
    this.practice.stopAnimating = false;

    // animate the moves 1 by 1 (except for the last move)
    for (var i = 0; i < moves.length; i++) {
      // animate the move
      await this.board.movePiece(
        moves[i]["from"],
        moves[i]["to"],
        lastOnly ? i + 1 == moves.length : true
      );

      // if we need to stop animating
      if (this.practice.stopAnimating || this.practice.isInterrupted) {
        break;
      }

      // if we need to ignore this animation
      if (
        _lineIdx != this.practice.lineIdx ||
        _moveIdx != this.practice.moveIdx
      ) {
        break;
      }

      // update the board (in case of castling)
      this.board.setPosition(moves[i].after);
    }
  }

  /**
   * Counters functions.
   * - showCounters
   * - hideCounters
   * - reduceMoveCount
   * - addCorrectCount
   * - addFailedCount
   * - saveMoveCounters
   */

  // show the counters
  showCounters(moveCount) {
    this.containers.counters.classList.remove("is-hidden");

    this.containers.moveCounter.innerHTML = moveCount;
    this.containers.correctCounter.innerHTML = 0;
    this.containers.failedCounter.innerHTML = 0;
  }

  // hide the counters
  hideCounters() {
    this.containers.counters.classList.add("is-hidden");
  }

  // increase the move count
  increaseMoveCount(count = 1) {
    this.containers.moveCounter.innerHTML =
      parseInt(this.containers.moveCounter.innerHTML) + count;
  }

  // reduce the move count
  reduceMoveCount(count = 1) {
    this.containers.moveCounter.innerHTML = Math.max(
      0,
      parseInt(this.containers.moveCounter.innerHTML) - count
    );
  }

  // add to the correct count
  addCorrectCount() {
    this.containers.correctCounter.innerHTML =
      parseInt(this.containers.correctCounter.innerHTML) + 1;
  }

  // add to the failed count
  addFailedCount() {
    this.containers.failedCounter.innerHTML =
      parseInt(this.containers.failedCounter.innerHTML) + 1;
  }

  /**
   * Saves counters for 1 or multiple moves.
   *
   * moves: [{ fen: <fen>, move: <move>, [correct: 1 | failed: 1] }]
   *
   * @param {*} moves
   * @memberof Practice
   */
  saveMoveCounters(moves) {
    // not for analysis moves
    if (this.type == "analysis") {
      return false;
    }

    // we need to refresh the repertoire data when starting a new practice
    this.needsRefresh = true;

    // set the url
    var url = "/api/repertoire/counters";

    var data = { 
      type: this.type,
      moves: moves
    };

    // update the move counters
    fetch(url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:");
        console.log(response);
      })
      .catch((error) => {
        console.warn("Error:", error);
        // show the error icon
        Utils.showError();
      });
  }

  /**
   * Info containers functions.
   * - showInfo
   * - showConfirm
   * - showWarning
   * - showHint
   * - hideHint
   */

  // show an info message
  showInfo(status = "") {
    this.containers.confirm.classList.add("is-hidden");
    this.containers.warning.classList.add("is-hidden");
    this.containers.info.classList.remove("is-hidden");
    this.containers.info.getElementsByTagName("span")[1].innerHTML = status;
  }

  // show a confirmation message
  showConfirm(status = "") {
    this.containers.info.classList.add("is-hidden");
    this.containers.warning.classList.add("is-hidden");
    this.containers.confirm.classList.remove("is-hidden");
    this.containers.confirm.getElementsByTagName("span")[1].innerHTML = status;
  }

  // show a warning message
  showWarning(status = "") {
    this.containers.info.classList.add("is-hidden");
    this.containers.confirm.classList.add("is-hidden");
    this.containers.warning.classList.remove("is-hidden");
    this.containers.warning.getElementsByTagName("span")[1].innerHTML = status;
  }

  // show a hint message
  showHint(hint = "") {
    this.containers.hint.classList.remove("is-hidden");
    this.containers.hint.getElementsByTagName("span")[1].innerHTML = hint;
  }

  // hide the hint messages
  hideHint() {
    this.containers.hint.classList.add("is-hidden");
  }

  /**
   * Practice buttons functions.
   * - giveHint
   * - getPieceHint
   * - skipMove
   */

  // give a hint
  giveHint() {
    // if this is the 1st hint
    if (this.hintCounter == 0) {
      // get the hint and show it
      var hint = this.getPieceHint();
      this.showHint(hint);
    } else {
      // get the moves that haven't been played yet
      var notPlayed = this.practice.lineMoves.filter((move) => {
        return this.practice.lineMovesPlayed.indexOf(move) < 0;
      });

      // get the coordinates
      var coords = [];
      for (var i = 0; i < notPlayed.length; i++) {
        if (this.game.move(notPlayed[i])) {
          var last = this.game.history({ verbose: true }).pop();
          coords.push(last);
          this.game.undo();
        }
      }

      // mark the move(s)
      this.board.removeMarkers();
      if (this.hintCounter == 1) {
        for (var i = 0; i < coords.length; i++) {
          this.board.addMarker(MARKER_TYPE.square, coords[i].from);
        }
      } else {
        for (var i = 0; i < coords.length; i++) {
          this.board.addMarker(MARKER_TYPE.square, coords[i].from);
          this.board.addMarker(MARKER_TYPE.square, coords[i].to);
        }
      }
    }

    // increase the hint counter
    this.hintCounter++;
  }

  // get a hint on which piece to move
  getPieceHint() {
    // the pieces
    var pieces = {
      p: "pawn",
      R: "rook",
      N: "knight",
      B: "bishop",
      Q: "queen",
      K: "king",
      O: "king",
      0: "king",
    };

    // get the not played moves
    var notPlayed = this.practice.lineMoves.filter((move) => {
      return this.practice.lineMovesPlayed.indexOf(move) < 0;
    });

    // if all moves have been played
    if (notPlayed.length == 0) {
      return "Bruh..";
    }

    // get the moves per piece
    var moves = [];
    var moveCnt = 0;
    for (var i = 0; i < notPlayed.length; i++) {
      var piece = pieces[notPlayed[i].charAt(0)]
        ? pieces[notPlayed[i].charAt(0)]
        : pieces["p"];

      if (moves[piece]) {
        moves[piece]++;
      } else {
        moves[piece] = 1;
        moveCnt++;
      }
    }

    // sort the moves, multiples first
    moves.sort();
    moves.reverse();

    // set the hint
    var hint = "";
    var idx = 0;
    for (var prop in moves) {
      if (hint == "") {
        if (moves[prop] == 1) {
          hint = "It's a " + prop + " move";
        } else {
          if (moves.length == 1) {
            if (moves[prop] == 2) {
              hint = "They are both " + prop + " moves";
            } else {
              hint = "They are all " + prop + " moves";
            }
          } else {
            hint = "There are " + moves[prop] + " " + prop + " moves";
          }
        }
      } else {
        if (idx + 1 == moveCnt) {
          hint += " and ";
        } else {
          hint += ", ";
        }
        if (moves[prop] == 1) {
          hint += "a " + prop + " move";
        } else {
          hint += moves[prop] + " " + prop + " moves";
        }
      }

      idx++;
    }

    hint += ".";

    return hint;
  }

  // get who's turn it is for a line
  getTurn(line) {
    // get the FEN after (for moves) or the current FEN (for root positions)
    var fen = line.after ? line.after : line.fen;

    // if we have a line, can we always just use that??
    if (line.line && line.line.length) {
      // get the number of moves
      var total =
        line.line.length + (this.type !== "analysis" && line.move ? 1 : 0);

      return total % 2 == 0 ? "w" : "b";
    }

    // get the color from the FEN
    var parts = fen.split(" ");
    var fenColor = parts[1];

    // is this still true ?? was for the move count i think.. of custom/roadmap reps?
    if (
      this.type == "analysis" ||
      (line.color == "black" && line.move == undefined)
    ) {
      fenColor = fenColor == "w" ? "b" : "w";
    }

    return fenColor;
  }

  // get the previous move
  getPrevMove(curr_lineIdx, curr_moveIdx) {
    var playableCnt = 0;

    // find the previous playable move
    while (playableCnt == 0) {
      // if this is an analysis line
      if (this.type == "analysis") {
        if (curr_lineIdx > 0) {
          curr_lineIdx--;
          curr_moveIdx = 0;
        } else {
          return [-1, -1, 0];
        }
      } else {
        if (curr_moveIdx > 0) {
          curr_moveIdx = curr_moveIdx - 1;
        } else if (curr_lineIdx > 0) {
          curr_lineIdx = curr_lineIdx - 1;
          curr_moveIdx = 0;
          var temp = this.practice.lines[curr_lineIdx];
          if (this.type != "analysis") {
            while (temp.moves && temp.moves.length == 1) {
              temp = temp.moves[0];

              curr_moveIdx++;
            }
          }
        } else {
          return [-1, -1, 0];
        }
      }

      //var color = this.practice.lines[curr_lineIdx].color;
      var color =
        curr_lineIdx >= 0 && curr_lineIdx < this.practice.lines.length
          ? this.practice.lines[curr_lineIdx].color
          : "";

      var temp = this.practice.lines[curr_lineIdx];
      if (this.type != "analysis") {
        for (var i = 0; i < curr_moveIdx; i++) {
          temp = temp.moves[0];
        }
      }

      // get who's turn it is
      var fenColor = this.getTurn(temp);

      // if it's our move

      //if (parts[1] == this.practice.lines[curr_lineIdx].color.substr(0, 1)) {
      if (fenColor == color.substr(0, 1)) {
        // get the moves for this line
        var temp = this.practice.lines[curr_lineIdx];
        if (this.type != "analysis") {
          for (var i = 0; i < curr_moveIdx; i++) {
            temp = temp.moves[0];
          }
        }

        // get the moves (if any)
        if (temp.moves) {
          // get the playable moves (not the autoplay moves)
          for (var i = 0; i < temp.moves.length; i++) {
            if (!temp.moves[i].autoplay) {
              playableCnt++;
            }
          }
        }
      }
    }

    return [curr_lineIdx, curr_moveIdx, playableCnt];
  }

  // get the next move
  getNextMove(curr_lineIdx, curr_moveIdx) {
    var playableCnt = 0;
    var playable = [];
    var color =
      curr_lineIdx >= 0 && curr_lineIdx < this.practice.lines.length
        ? this.practice.lines[curr_lineIdx].color
        : "";

    // find the previous playable move
    while (playableCnt == 0) {
      var temp = this.practice.lines[curr_lineIdx];
      if (this.type != "analysis") {
        for (var i = 0; i < curr_moveIdx; i++) {
          temp = temp.moves[0];
        }
      }

      playable = [];

      if (temp.moves) {
        // get the playable moves (not the autoplay moves)
        for (var i = 0; i < temp.moves.length; i++) {
          if (!temp.moves[i].autoplay) {
            playable.push(temp.moves[i]);
          }
        }
      }

      if (temp.moves && temp.moves.length > 1) {
        if (curr_lineIdx < this.practice.lines.length) {
          curr_lineIdx++;
          curr_moveIdx = 0;
        }
      } else if (
        playable.length > 0 &&
        playable[0].moves &&
        playable[0].moves.length > 0 &&
        this.type != "analysis"
      ) {
        curr_moveIdx++;
      } else {
        curr_lineIdx++;
        curr_moveIdx = 0;
      }

      // if there are no more moves (safety check)
      if (curr_lineIdx >= this.practice.lines.length) {
        break;
      }

      var fen = temp.after ? temp.after : temp.fen;

      var parts = fen.split(" ");

      var fenColor = parts[1];
      if (color == "black" && curr_lineIdx == 0 && curr_moveIdx == 0) {
        fenColor = fenColor == "w" ? "b" : "w";
      }

      // if it's our move
      if (fenColor == color.substr(0, 1)) {
        playableCnt = playable.length;
      }
    }

    return [curr_lineIdx, curr_moveIdx, playable];
  }

  // go back to the previous move
  async prevMove(
    _lineIdx = this.practice.lineIdx,
    _moveIdx = this.practice.moveIdx
  ) {
    // get the previous move values
    var [prev_lineIdx, prev_moveIdx, playableCount] = this.getPrevMove(
      this.practice.skip_lineIdx,
      this.practice.skip_moveIdx
    );

    // re-add any moves played in current position
    var increaseCount =
      this.practice.skip_lineIdx == this.practice.lineIdx &&
      this.practice.skip_moveIdx == this.practice.moveIdx
        ? this.practice.lineMovesPlayed.length
        : 0;
    // add playable moves count from previous move
    increaseCount += playableCount;

    // remember the current line/move idx
    this.practice.skip_lineIdx = prev_lineIdx;
    this.practice.skip_moveIdx = prev_moveIdx;

    // stop animating
    this.practice.stopAnimating = true;

    this.practice.skipCount++;
    var nextCount = this.practice.skipCount;

    //await this.waitForAnimationFinish();
    await this.interruptPractice();

    // update the move counter
    this.increaseMoveCount(increaseCount);

    if (nextCount != this.practice.skipCount) {
      return;
    }

    if (
      prev_lineIdx != this.practice.skip_lineIdx ||
      prev_moveIdx != this.practice.skip_moveIdx
    ) {
      return;
    }

    // if valid
    if (prev_lineIdx >= 0) {
      // set the line & move index
      this.practice.lineIdx = prev_lineIdx;
      this.practice.moveIdx = prev_moveIdx;
      // animate to the next position
      this.practice.animateToPosition = true;
      this.practice.animateFromBeginning = true;
      // remove all markers
      this.board.removeMarkers();
      // remove arrows
      this.board.removeArrows();
      // run the previous practice
      this.runPractice();
    }
  }

  // skip the current move
  async skipMove(
    _lineIdx = this.practice.skip_lineIdx,
    _moveIdx = this.practice.skip_moveIdx
  ) {
    // if practice was paused
    if (this.practice.paused) {
      // continue practice
      this.continuePractice();

      return;
    }

    // remember the current line/move idx
    var curr_lineIdx = this.practice.skip_lineIdx;
    var curr_moveIdx = this.practice.skip_moveIdx;

    this.practice.skipCount++;
    var nextCount = this.practice.skipCount;

    // get the next move values
    var [next_lineIdx, next_moveIdx, playable] = this.getNextMove(
      this.practice.skip_lineIdx,
      this.practice.skip_moveIdx
    );

    var reduceCount =
      curr_lineIdx == this.practice.lineIdx &&
      curr_moveIdx == this.practice.moveIdx
        ? (this.practice.lineMovesMultiple.length > 1
            ? this.practice.lineMovesMultiple.length
            : this.practice.lineMoves.length) -
          this.practice.lineMovesPlayed.length
        : playable.length;

    // remember the current line/move idx
    this.practice.skip_lineIdx = next_lineIdx;
    this.practice.skip_moveIdx = next_moveIdx;

    this.practice.lineIdx = next_lineIdx;
    this.practice.moveIdx = next_moveIdx;

    // stop animating
    this.practice.stopAnimating = true;

    //await this.waitForAnimationFinish();
    await this.interruptPractice();

    // update the move counter
    this.reduceMoveCount(reduceCount);

    if (nextCount != this.practice.skipCount) {
      return;
    }

    if (
      next_lineIdx != this.practice.skip_lineIdx ||
      next_moveIdx != this.practice.skip_moveIdx
    ) {
      return;
    }

    // set the line & move index
    this.practice.lineIdx = next_lineIdx;
    this.practice.moveIdx = next_moveIdx;

    // animate to the next position
    this.practice.animateToPosition = true;
    this.practice.animateFromBeginning = false;

    // if we need to make the next move
    if (this.practice.skip_moveIdx > 0) {
      try {
        // make the move
        this.game.move(playable[0]["move"]);
        // get the last move
        var last = this.game.history({ verbose: true }).pop();

        // animate the move
        await this.board.movePiece(last.from, last.to, true);

        // update the board (in case of castling)
        this.board.setPosition(this.game.fen());
        // don't animate to the next position
        this.practice.animateToPosition = false;
      } catch (err) {
        console.warn(err);
      }
    }

    // remove all markers
    this.board.removeMarkers();
    // remove arrows
    this.board.removeArrows();
    // run the previous practice
    this.runPractice();
  }

  onAnalyseGame() {
    window.open(
      "https://lichess.org/analysis/pgn/" +
        encodeURIComponent(this.game.pgn()) +
        (this.board.getOrientation() == COLOR.black ? "?color=black" : ""),
      "_blank"
    );
    /*
    window.open(
      "https://lichess.org/analysis?fen=" + encodeURIComponent(this.getFen()),
      "_blank"
    );
    */
  }

  /**
   * Played moves container functions.
   * - showPlayedMoves
   * - hidePlayedMoves
   * - setPlayedMove
   */

  // show the played moves container
  showPlayedMoves(count) {
    // clear the moves list
    while (this.playedMovesList.lastChild) {
      this.playedMovesList.removeChild(this.playedMovesList.firstChild);
    }

    // add the rows for the moves
    for (var i = 0; i < count; i++) {
      var row = document.createElement("div");
      row.className =
        "flex is-justify-content-space-between  is-align-items-center px-2 py-3" +
        (i + 1 == count
          ? ""
          : " border-b border-tacao-300/60 dark:border-slate-800");

      var cell = document.createElement("div");
      cell.className = "tc-sharp";
      cell.innerHTML = Math.ceil(this.practice.moveNr / 2) + ". _";

      row.appendChild(cell);

      cell = document.createElement("div");
      cell.className =
        "hidden cursor-pointer px-2 py-1 text-xs font-semibold tc-sharp hover:bg-tacao-100 hover:dark:bg-slate-600 rounded-full border border-transparent hover:border-tacao-200 hover:dark:border-slate-800";
      cell.innerHTML = "";

      row.appendChild(cell);

      this.playedMovesList.appendChild(row);
    }

    // set the label
    this.playedMovesContainer.children[0].innerHTML =
      count > 1 ? "Moves" : "Move";

    // show the moves list
    this.playedMovesContainer.classList.remove("is-hidden");
  }

  // hide the played moves container
  hidePlayedMoves() {
    this.playedMovesContainer.classList.add("is-hidden");
  }

  // add a move to the played moves container
  setPlayedMove(index, move, cp = null, mate = null, line = []) {
    // set the CP eval
    var cpEval =
      cp !== null
        ? '&nbsp;<sup class="text-xs has-text-faded">' +
          (cp >= 0 ? "+" : "") +
          Math.round(cp) / 100 +
          "</sup>"
        : mate !== null
        ? '&nbsp;<sup class="text-xs has-text-faded">M' + mate + "</sup>"
        : "";
    // set the move
    this.playedMovesList.children[index].children[0].innerHTML =
      Math.ceil(this.practice.moveNr / 2) + ". " + move + cpEval;

    // add the show line link
    if (line && line.length > 0) {
      this.playedMovesList.children[index].children[1].innerHTML = "show line";
      this.playedMovesList.children[index].children[1].classList.remove(
        "hidden"
      );

      // add the click handler
      this.playedMovesList.children[index].children[1].addEventListener(
        "click",
        (event) => {
          // add the variation
          var variation = this.addVariation(this.practice.moveNr, line);
          // update the pgn field
          this.updatePgnField();
          // if the practice is paused
          if (this.practice.paused) {
            // goto the move
            this.gotoMove(this.practice.moveNr, variation);
          }
        }
      );
    }
  }
}

// initialise the Practice object once the page is loaded
document.addEventListener("DOMContentLoaded", (event) => {
  var practice = new Practice();
});

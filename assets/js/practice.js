import {
  MyChessBoard, CUSTOM_MARKER_TYPE, BOARD_STATUS, BOARD_SETTINGS, PIECE_TILESIZE,
} from "chessboard";
import { CUSTOM_ARROW_TYPE } from "ThickerArrows";
import { MyChess } from "chess";
import { COLOR } from "../vendor/cm-chessboard/src/view/ChessboardView.js";
import { MARKER_TYPE } from "../vendor/cm-chessboard/src/extensions/markers/Markers.js";
import { Utils } from "utils";
import { balloons } from 'https://cdn.jsdelivr.net/npm/balloons-js@0.0.3/+esm';

import "../styles/chessboard.css";

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

    // Get the elements
    this.getElements();

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

    // set the PgnField container
    this.setPgnField(document.getElementById("pgnField"));

    // attach click handler to the repertoire type buttons
    if (this.type != "custom") {
      this.initRepertoireButtons();
    }

    // Add listeners
    this.addListeners();
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

  // Get the required elements
  getElements() {
    // Get the data-elements for reference
    this.elements = [];
    document.querySelectorAll("[data-element]").forEach(el => {
      if (el.dataset.element !== "yes") return;
      this.elements[el.id] = el;
    });

    console.log('getElements', this.elements);

    // get the practice type
    this.type = this.elements.board.getAttribute("data-type");
    // get the repertoire id (from the roadmap)
    this.repertoireId = this.elements.board.getAttribute("data-id");
  }

  // Add event listeners
  addListeners() {
    // Open in repertoire
    this.elements.practiceInfoOpenInRepertoireButton.addEventListener(
      "click",
      this.openInRepertoire.bind(this)
    );

    // On group select change
    this.elements.practiceGroupSelect.addEventListener(
      "change",
      this.onGroupSelectChange.bind(this)
    );
    this.elements.suggestionSubmitButton.addEventListener("click", () => {
      document.forms["repertoireForm"].submit();
    });

    // Attach pgn navigation button handlers
    this.elements.pgnNavigationContainer.children[0].addEventListener(
      "click",
      this.gotoFirst.bind(this)
    );
    this.elements.pgnNavigationContainer.children[1].addEventListener(
      "click",
      this.gotoPrevious.bind(this)
    );
    this.elements.pgnNavigationContainer.children[2].addEventListener(
      "click",
      this.gotoNext.bind(this)
    );
    this.elements.pgnNavigationContainer.children[3].addEventListener(
      "click",
      this.gotoLast.bind(this)
    );

    // Attach button click handlers
    this.elements.startPracticeButton.addEventListener(
      "click",
      this.onStartPractice.bind(this)
    );
    this.elements.giveHintButton.addEventListener("click", this.giveHint.bind(this));
    this.elements.showPracticeInfoButton.addEventListener(
      "click",
      this.togglePracticeInfo.bind(this)
    );
    this.elements.prevMoveButton.addEventListener("click", () => {
      this.prevMove();
    });
    this.elements.skipMoveButton.addEventListener("click", () => {
      this.skipMove();
    });

    this.elements.analyseGameButton.addEventListener(
      "click",
      this.onAnalyseGame.bind(this)
    );
  }

  createChessboard() {
    // get the repertoire color
    this.color = this.elements.board.getAttribute("data-color");

    // the board settings
    const boardSettings = {
      orientation: this.type == "black" ? COLOR.black : COLOR.white,
      style: {
        pieces: {},
      },
    };
    if (this.settings.board) {
      boardSettings.style.cssClass = this.settings.board;
    }
    if (this.settings.pieces) {
      boardSettings.style.pieces.file = "pieces/" + this.settings.pieces;
      boardSettings.style.pieces.tileSize = PIECE_TILESIZE.get(this.settings.pieces);
    }
    if (this.settings.animation) {
      boardSettings.style.animationDuration = this.settings.animation;
    }

    // create the chess board
    this.init(this.elements.board, boardSettings);

    // Remove the skeleton loader
    this.elements.board.parentNode.removeChild(this.elements.board.previousElementSibling);

    // disable move input
    this.disableMoveInput();
  }

  /**
   * Get the settings from the API and initialise the board.
   *
   * @memberof Practice
   */
  getSettings() {
    // show the page loader
    Utils.showLoading();

    const url = "/api/settings";

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

    // Create the chessboard
    this.createChessboard();
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
    // Save modal
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

    // Ignore Modal
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
          this.elements.practiceCustomRepertoireField.children[0].children[0].innerHTML =
            e.data[1].Name + " (" + e.data[2] + ")";
        } else {
          // set the practice info ECO field
          this.elements.practiceInfoFields.children[1].innerHTML =
            e.data[1].Code + ", " + e.data[1].Name;
        }
        break;
    }
  }

  /**
   * Sets the next queueud practice run. It interrupts and awaits the finish of the current run.
   * There is a debounce time to make fast prev/next clicks go smoother.
   * 
   * @param {*} line 
   * @param {*} move 
   */
  enqueueRun(line, move, isMouseClick = false) {
    const now = Date.now();
    // Use a debounce time for mouse click navigation
    let debounceTime = isMouseClick ? 100 : 0;

    if (isMouseClick) {
      if (this.practice._lastClickTime) {
        const gap = now - this.practice._lastClickTime;
        debounceTime = gap < 200 ? 350 : 100;
      }
      this.practice._lastClickTime = now;
    }

    console.log('enqueueRun:', line, move, 'debounce', debounceTime);

    this.practice._nextQueuedItem = { line, move, debounceTime };
    this.practice._nextQueuedItemUpdated = true;

    if (!this._queueRunning) {
      this._queueRunning = true;
      this._processQueue();
    }
  }

  /**
   * Process the queue. It will keep running practices while they are queued up.
   * It pauses running the next practice in case of fast clicks.
   * Only restarting once the user stops clicking for a short time.
   */
  async _processQueue() {
    while (this.practice._nextQueuedItem !== null) {
      const { line, move, debounceTime } = this.practice._nextQueuedItem;

      console.log('_processQueue:', line, move);

      this.practice._nextQueuedItem = null;

      // Interrupt the current practice run
      this.interruptPractice();

      console.log('_processQueue - before runPractice', line, move);

      this.practice._currentPracticePromise = this.runPractice(line, move); // await the animation + rest of function

      await this.practice._currentPracticePromise;

      console.log('_processQueue - after runPractice', line, move);

      this.practice._currentPracticePromise = null;

      while (this.practice._nextQueuedItem !== null) {
        // we read the nextQueuedItem now..
        this.practice._nextQueuedItemUpdated = false;
        // use the debounceTime of the last queued item
        const debounce = this.practice._nextQueuedItem?.debounceTime ?? 250;
        // wait 50ms, then check again
        await new Promise(resolve => setTimeout(resolve, debounce));
        // break if not updated in the meantime
        if (this.practice._nextQueuedItemUpdated === false) break;
      }
    }
    this._queueRunning = false;
  }

  // Interrupt the practice & animation
  interruptPractice() {
    this.practice.isInterrupted = true;
    this.practice.stopAnimating = true;
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
      const isCorrect = this.practice.lineMoves.includes(this.lastMove.san);

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
          const failed = [];

          // if we have multiple moves here
          if (this.practice.isMultiple) {
            // add only the moves that had not yet been played correctly
            for (let i = 0; i < this.practice.lineMoves.length; i++) {
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
          this.undoLastMove();
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
    this.elements.pgnContainer.classList.remove("is-hidden");
  }

  /**
   * Hides the PGN container.
   *
   * @memberof Practice
   */
  hidePgnContainer() {
    this.elements.pgnContainer.classList.add("is-hidden");
  }

  /**
   * Toggles the PGN navigation buttons.
   *
   * @memberof Practice
   */
  togglePgnNavigationButtons() {
    // toggle the pgn navigation buttons
    this.elements.pgnNavigationContainer.children[0].disabled = this.isFirst();
    this.elements.pgnNavigationContainer.children[1].disabled = this.isFirst();
    this.elements.pgnNavigationContainer.children[2].disabled = this.isLast();
    this.elements.pgnNavigationContainer.children[3].disabled = this.isLast();
  }

  // open the position in the repertoire
  openInRepertoire() {
    // clear the form
    while (this.elements.repertoireForm.firstChild) {
      this.elements.repertoireForm.removeChild(this.elements.repertoireForm.lastChild);
    }

    // set the form action to the repertoire color
    this.elements.repertoireForm.action = "./repertoire/" + this.practice.lineColor;

    const inp = document.createElement("input");
    inp.type = "hidden";
    inp.name = "fen";

    this.elements.repertoireForm.appendChild(inp);

    const history = this.game.history({ verbose: true });

    for (let i = 0; i < history.length; i++) {
      const inp = document.createElement("input");
      inp.type = "hidden";
      inp.name = "line[]";
      inp.value = history[i].san;

      this.elements.repertoireForm.appendChild(inp);
    }

    this.elements.repertoireForm.submit();
  }

  /**
   * Suggestion Container functions.
   */

  showSuggestionContainer() {
    this.elements.suggestionContainer.classList.remove("is-hidden");
  }

  hideSuggestionContainer() {
    this.elements.suggestionContainer.classList.add("is-hidden");
  }

  updateSuggestionField(color, fen, suggestion) {
    // clear the form
    while (this.elements.repertoireForm.firstChild) {
      this.elements.repertoireForm.removeChild(this.elements.repertoireForm.lastChild);
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
    this.elements.repertoireForm.action = "./repertoire/" + color;

    let inp = document.createElement("input");
    inp.type = "hidden";
    inp.name = "fen";
    inp.value = fen;

    this.elements.repertoireForm.appendChild(inp);

    if (suggestion) {
      for (let i = 0; i < suggestion.line.length; i++) {
        inp = document.createElement("input");
        inp.type = "hidden";
        inp.name = "line[]";
        inp.value = suggestion.line[i];

        this.elements.repertoireForm.appendChild(inp);
      }
    }

    this.elements.suggestionField.innerHTML = suggestion
      ? "The move <b>" + suggestion.display + "</b> is not in your repertoire."
      : "";
  }

  /**
   * Practice Info Container functions.
   */

  togglePracticeInfo(eventObject) {
    // blur the button
    this.elements.showPracticeInfoButton.blur();

    console.info("togglePracticeInfo", eventObject);

    if (
      !this.elements.showPracticeInfoButton.disabled &&
      this.elements.showPracticeInfoButton.checked
    ) {
      // get the moves & FEN
      const moves =
        this.status == BOARD_STATUS.animatingMoves &&
          this.practice.lineMovesPlayable.length > 0
          ? this.practice.lines[this.practice.lineIdx].line
          : null;
      const fen =
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

      this.elements.practiceInfoContainer.classList.remove("is-hidden");
    } else {
      // update toggle setting
      if (eventObject !== false) {
        localStorage.setItem("show-practice-info", false);
      }

      this.elements.practiceInfoContainer.classList.add("is-hidden");
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
    // blur the button
    this.analysis.saveButton.blur();
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
    this.showSaveModal();
  }

  // fired when the save dialog is confirmed
  onAnalysisSaveConfirmed() {
    // get a game with the moves
    const game = this.getCurrentGame();

    // get the moves
    let pgn = "";
    const moves = game.historyWithCorrectFen();

    for (let i = 0; i < moves.length; i++) {
      if (i % 2 == 0) {
        pgn += i / 2 + 1 + ". ";
      }
      pgn += moves[i]["san"];

      moves[i]["pgn"] = pgn;
      moves[i]["autoplay"] = true;

      pgn += " ";
    }

    // add the engine moves
    const addIf = [
      true,
      this.analysis.saveDialog.radioTop2.checked ||
      this.analysis.saveDialog.radioTop3.checked,
      this.analysis.saveDialog.radioTop3.checked,
    ];
    const engineMoves = [];
    for (
      let i = 0;
      i < this.practice.lines[this.practice.lineIdx].moves.length;
      i++
    ) {
      // if we need to add this move
      if (addIf[i]) {
        // make the move
        game.move(this.practice.lines[this.practice.lineIdx].moves[i].move);
        // get the move details
        const last = game.historyWithCorrectFen().pop();
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
    const url = "/api/analysis/save";

    // set the data object
    const data = {
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
      .then((response) => { })
      .catch((error) => {
        console.warn("Error:", error);
        // show the error icon
        Utils.showError();
      });

    // remove from the current practice lines
    this.onAnalysisDiscard(null, false);

    // close the modal
    this.closeSaveModal();
  }

  // get the current game with the moves for this line
  getCurrentGame() {
    // create a new chess game
    const game = new MyChess();
    // get the initial fen
    const initialFen = this.practice.lines[this.practice.lineIdx].initialFen
      ? this.practice.lines[this.practice.lineIdx].initialFen
      : "";
    // reset the game
    if (initialFen != "") {
      game.load(initialFen);
    }

    // play the line moves
    for (
      let i = 0;
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
    const url = "/api/analysis/ignore";
    // set the data
    const data = {
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
      .then((response) => { })
      .catch((error) => {
        console.warn("Error:", error);
        // show the error icon
        Utils.showError();
      });

    // remove from the current practice lines
    this.onAnalysisDiscard(null, false);

    // close the modal
    this.showIgnoreModal();
  }

  // fired when the analysis discard button is clicked
  onAnalysisDiscard(event, removeFromDb = true) {
    // blur the button
    this.analysis.discardButton.blur();
    // we need to refresh the repertoire data when starting a new practice
    this.needsRefresh = true;

    // if we need to remove this move from the database
    if (removeFromDb) {
      // set the API url
      const url = "/api/analysis";
      // set the data
      const data = {
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
        .then((response) => { })
        .catch((error) => {
          console.warn("Error:", error);
          // show the error icon
          Utils.showError();
        });
    }

    // the FEN & move we need to delete
    const fen = this.practice.lines[this.practice.lineIdx].fen;
    const move = this.practice.lines[this.practice.lineIdx].move;

    // Get the current line/move
    const currentLine = this.practice.lineIdx;
    const currentMove = this.practice.moveIdx;

    // reduce by number of moves counter
    let reduceBy = 0;
    let reduceTotal = 0;
    for (let i = 0; i < this.practice.lines.length; i++) {
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
          currentLine--;
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
    currentMove = 0;
    //this.practice.moveIdx = 0;
    //this.practice.skip_moveIdx = 0;

    // animate to the next position
    this.practice.animateToPosition = true;
    this.practice.animateFromBeginning = false;

    // remove all markers
    this.board.removeMarkers();
    // remove arrows
    this.board.removeArrows();

    // We need to continue with currentLine, currentMove
    this.practice.lineIdx = currentLine;
    this.practice.moveIdx = currentMove;

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
            this.undoLastMove();
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
    //this.elements.skipMoveButton.innerHTML = "Continue";
    this.elements.skipMoveButton.title = "Continue";
    // hide the hint (if showing)
    this.hideHint();
    // enable the pgn links
    this.setPgnWithLinks(true);
    // toggle the pgn navigation buttons
    this.togglePgnNavigationButtons();
    // show the pgn navigation buttons
    this.elements.pgnNavigationContainer.classList.remove("is-hidden");

    // allow navigation by arrow left/right
    this.setOption(BOARD_SETTINGS.navigation, true);
  }

  // continue the practice
  continuePractice(gotoNext = true) {
    // if practice was paused
    if (this.practice.paused) {
      // set the skip move button text
      //this.elements.skipMoveButton.innerHTML = "Skip this move";
      this.elements.skipMoveButton.title = "Skip this move";
      // disable the pgn links
      this.setPgnWithLinks(false);
      // hide the pgn navigation buttons
      this.elements.pgnNavigationContainer.classList.add("is-hidden");

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
      // Enqueue the practice run
      this.enqueueRun(this.practice.lineIdx, this.practice.moveIdx);
    }
  }

  // goto the next move
  gotoNextMove(animate = false) {

    this.practice.animateToPosition = animate;
    this.practice.animateFromBeginning = false;

    // Get the next move
    const nextMove = this.practice.moveIdx + 1;

    // Enqueue the practice run
    this.enqueueRun(this.practice.lineIdx, nextMove);
  }

  // goto the next line
  gotoNextLine(animate = true) {

    this.practice.animateToPosition = animate;
    this.practice.animateFromBeginning = false;

    // Get the next linve
    const nextLine = this.practice.lineIdx + 1;
    const nextMove = 0;

    // Enqueue the practice run
    this.enqueueRun(nextLine, nextMove);
  }

  // called when a practice is finished, all moves played
  // show info ? toggle buttons, etc..
  onFinishPractice() { }

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
      const url = "/api/practice";

      // show the page loader
      Utils.showLoading();

      const data = { id: this.repertoireId };

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
    this.elements.startPracticeButton.disabled = false;

    // pass the ECO data to the worker
    console.info("-- ECO data set in worker", this.repertoire.eco);
    this.worker.postMessage(["setData", this.repertoire.eco]);

    // get the number of moves (ours) for the different repertoires
    if (this.type != "custom") {
      const moveCounts = ["", "", 0, 0, "", 0];
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
      const moves =
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
      const pgn = this.getPgnForMoves(moves);
      // set the custom repertoire field
      this.elements.practiceCustomRepertoireField.children[0].children[0].innerHTML = pgn;
      // get the ECO code
      console.info("-- get ECO data for custom repertoire");
      this.worker.postMessage(["getEco", pgn, "custom"]);

      // hide the repertoire type buttons
      this.hideRepertoireButtons();
    }

    // get the right repertoire
    const rep =
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
    // toggle the pgn field
    this.pgnField.setOptions({ pauseUpdate: (type !== 'analysis') });
    // if we don't have this repertoire type, do nothing
    if (this.repertoire.length == 0) {
      return;
    }
    // reset the board
    this.game.reset();
    // Make sure the board is loaded
    if (this.board) {
      // reset the position
      this.board.setPosition(this.game.fen());
      // remove the markers
      this.board.removeMarkers();
      // remove arrows
      this.board.removeArrows();
      // set the orientation
      const orient = this.type == "black" ? COLOR.black : COLOR.white;
      if (this.board.getOrientation() != orient) {
        this.board.setOrientation(orient);
      }

      // disable move input
      this.disableMoveInput();
    }

    // refresh the repertoire
    this.getRepertoire();
  }

  // add event listeners to the repertoire type buttons
  initRepertoireButtons() {
    this.elements.practiceRepertoireButtons.children[0].children[0].addEventListener(
      "click",
      (event) => {
        this.showRepertoireType("white");
      }
    );
    this.elements.practiceRepertoireButtons.children[1].children[0].addEventListener(
      "click",
      (event) => {
        this.showRepertoireType("black");
      }
    );
    this.elements.practiceRepertoireButtons.children[2].children[0].addEventListener(
      "click",
      (event) => {
        this.showRepertoireType("new");
      }
    );
    this.elements.practiceRepertoireButtons.children[3].children[0].addEventListener(
      "click",
      (event) => {
        this.showRepertoireType("recommended");
      }
    );
    this.elements.practiceRepertoireButtons.children[4].children[0].addEventListener(
      "click",
      (event) => {
        this.showRepertoireType("all");
      }
    );
    this.elements.practiceRepertoireButtons.children[5].children[0].addEventListener(
      "click",
      (event) => {
        this.showRepertoireType("analysis");
      }
    );
  }

  // hide the repertoire buttons
  hideRepertoireButtons() {
    // hide  the repertoire type buttons
    this.elements.practiceRepertoireButtons.classList.add("is-hidden");
    // show the custom repertoire field
    this.elements.practiceCustomRepertoireField.classList.remove("is-hidden");

    // hide the groups
    this.hideGroups();
  }

  // toggle the repertoire type buttons
  toggleRepertoireButtons(moveCounts) {
    // toggle the repertoire type buttons
    this.elements.practiceRepertoireButtons.children[0].children[0].disabled =
      this.repertoire.white.length == 0;
    this.elements.practiceRepertoireButtons.children[1].children[0].disabled =
      this.repertoire.black.length == 0;
    this.elements.practiceRepertoireButtons.children[2].children[0].disabled =
      this.repertoire.new.length == 0;
    if (this.repertoire.new.length == 0) {
      this.elements.practiceRepertoireButtons.children[2].classList.add("is-hidden");
    } else {
      this.elements.practiceRepertoireButtons.children[2].classList.remove("is-hidden");
    }
    this.elements.practiceRepertoireButtons.children[3].children[0].disabled =
      this.repertoire.recommended.length == 0;
    if (this.repertoire.recommended.length == 0) {
      this.elements.practiceRepertoireButtons.children[3].classList.add("is-hidden");
    } else {
      this.elements.practiceRepertoireButtons.children[3].classList.remove("is-hidden");
    }
    this.elements.practiceRepertoireButtons.children[4].children[0].disabled =
      this.repertoire.white.length == 0 && this.repertoire.black.length == 0;
    this.elements.practiceRepertoireButtons.children[5].children[0].disabled =
      this.repertoire.analysis.length == 0;

    this.elements.practiceRepertoireButtons.children[2].children[2].children[0].innerHTML =
      moveCounts[2];
    this.elements.practiceRepertoireButtons.children[3].children[2].children[0].innerHTML =
      moveCounts[3];
    this.elements.practiceRepertoireButtons.children[5].children[2].children[0].innerHTML =
      moveCounts[5];

    // select the right type
    const idx = this.types.indexOf(this.type);
    // set to "all" if there are no practice lines for this type
    if (
      idx == -1 ||
      this.elements.practiceRepertoireButtons.children[idx].children[0].disabled
    ) {
      // check the checkbox
      this.elements.practiceRepertoireButtons.children[4].children[0].checked = true;
    }

    // toggle the group select container
    if (
      this.elements.practiceRepertoireButtons.children[4].children[0].checked &&
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
    while (this.elements.practiceGroupSelect.lastChild) {
      this.elements.practiceGroupSelect.removeChild(
        this.elements.practiceGroupSelect.firstChild
      );
    }

    const opt = document.createElement("option");
    opt.value = "";
    opt.text =
      this.repertoire.groups.length == 0
        ? "No groups available"
        : "No group selected";

    this.elements.practiceGroupSelect.appendChild(opt);

    const groupsSorted = [];

    for (let i = 0; i < this.repertoire.groups.length; i++) {
      groupsSorted.push({ id: i, name: this.repertoire.groups[i].name });
    }

    groupsSorted.sort((a, b) => {
      if (a.name === b.name) return 0;
      return a.name > b.name ? 1 : -1;
    });

    for (let i = 0; i < groupsSorted.length; i++) {
      opt = document.createElement("option");
      opt.value = groupsSorted[i].id;
      opt.text = groupsSorted[i].name;

      this.elements.practiceGroupSelect.appendChild(opt);
    }
  }

  showGroups() {
    this.elements.practiceGroupContainer.classList.remove("is-hidden");
  }

  hideGroups() {
    this.elements.practiceGroupContainer.classList.add("is-hidden");
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
      this.elements.practiceGroupSelect.value == ""
        ? null
        : this.elements.practiceGroupSelect.value
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
    let ourMoveTotal = 0;

    for (let i = 0; i < lines.length; i++) {
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

      let playableCnt = 0;
      if (ourMove) {
        for (let x = 0; x < lines[i].moves.length; x++) {
          if (!lines[i].moves[x].autoplay) {
            playableCnt++;
          }
        }
      }

      // the total moves for this line
      let lineMoveTotal = ourMove ? playableCnt : 0;

      // make a copy of the line
      const copy = lines.slice(i, i + 1)[0];

      let addedIdx = -1;

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
        const line = [...lineMoves];
        if (lines[i].move) {
          line.push(lines[i].move);
        }

        // get the practice lines
        const sub = this.getPracticeLines(
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

    this.practice.lastQueuedLine = 0;
    this.practice.lastQueuedMove = 0;

    this.practice.lineColor = "";
    this.practice.lineMoves = [];
    this.practice.lineMovesMultiple = [];
    this.practice.lineMovesPlayed = [];
    this.practice.initialFen = "";
    this.practice.currentFen = "";

    this.practice.isInterrupted = false;
    this.practice.stopAnimating = false;

    this.practice.paused = false;
    this.practice.pausedFen = "";

    // set the skip move button text
    //this.elements.skipMoveButton.innerHTML = "Skip this move";
    this.elements.skipMoveButton.title = "Skip this move";

    // toggle the buttons
    this.elements.startPracticeButton.disabled = true;
    this.elements.startPracticeButton.classList.add("is-hidden");
    this.elements.giveHintButton.disabled = false;
    this.elements.giveHintButton.classList.remove("is-hidden");
    this.elements.prevMoveButton.disabled = true;
    this.elements.prevMoveButton.classList.remove("is-hidden");
    this.elements.skipMoveButton.disabled = false;
    this.elements.skipMoveButton.classList.remove("is-hidden");

    if (this.type == "analysis") {
      this.elements.showPracticeInfoButton.disabled = true;
      this.elements.showPracticeInfoButton.nextElementSibling.classList.add("is-hidden");

      this.elements.practiceInfoContainer.classList.add("is-hidden");
    } else {
      this.elements.showPracticeInfoButton.disabled = false;
      this.elements.showPracticeInfoButton.nextElementSibling.classList.remove(
        "hidden"
      );

      // get the show info setting
      const showPracticeInfo = localStorage.getItem("show-practice-info");
      // toggle the checked state
      this.elements.showPracticeInfoButton.checked = showPracticeInfo === "true";

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

    // Enqueue the practice run
    this.enqueueRun(this.practice.lineIdx, this.practice.moveIdx);

    return;
  }

  // stop a practice (when switching type)
  stopPractice() {
    // toggle the buttons
    this.elements.startPracticeButton.disabled = false;
    this.elements.startPracticeButton.innerHTML = "Start your practice";
    this.elements.startPracticeButton.classList.remove("is-hidden");
    this.elements.giveHintButton.disabled = true;
    this.elements.giveHintButton.classList.add("is-hidden");
    this.elements.prevMoveButton.disabled = true;
    this.elements.prevMoveButton.classList.add("is-hidden");
    this.elements.skipMoveButton.disabled = true;
    this.elements.skipMoveButton.classList.add("is-hidden");
    this.elements.showPracticeInfoButton.disabled = true;
    this.elements.showPracticeInfoButton.nextElementSibling.classList.add("is-hidden");

    this.togglePracticeInfo(false);

    // stop animating
    this.practice.stopAnimating = true;

    // reset the game & board
    this.game.reset();
    // Make sure the board is loaded
    if (this.board) {
      this.board.setPosition(this.game.fen());
    }

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
    if (!this.elements.showPracticeInfoButton.checked) {
      return false;
    }

    // get the PGN & FEN
    const pgn = moves == null ? this.game.pgn() : this.getPgnForMoves(moves);
    fen = fen == null ? this.getFen() : fen;

    // get the FEN parts to determine who's turn it is
    const parts = fen.split(" ");
    // if this is not our move, don't update..
    if (
      parts[1] !== this.practice.lines[this.practice.lineIdx].color.substr(0, 1)
    ) {
      return false;
    }

    // if the same PGN as currently showing
    if (this.elements.practiceInfoFields.children[3].innerHTML == pgn) {
      return false;
    }

    // if the board is animating moves
    if (this.status == BOARD_STATUS.animatingMoves && moves == null) {
      return false;
    }

    // update the info fields
    this.elements.practiceInfoFields.children[1].innerHTML = "";
    this.elements.practiceInfoFields.children[3].innerHTML = pgn;
    this.elements.practiceInfoFields.children[5].innerHTML = fen;

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
    let temp = this.practice.lines[this.practice.lineIdx];
    if (this.type != "analysis") {
      for (let i = 0; i < this.practice.moveIdx; i++) {
        temp = temp.moves[0];
      }
    }

    // get the playable moves (not the autoplay moves)
    let practiceCount = 0;
    let practiceFailed = 0;
    let practiceInARow = 0;
    let count = 0;
    for (let i = 0; i < temp.moves.length; i++) {
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

    const pct =
      practiceCount == 0
        ? 100
        : 100 - Math.round((practiceFailed / practiceCount) * 100);

    const colors = [
      "is-danger is-light",
      "is-danger is-light",
      "is-warning is-light",
      "is-success is-light",
    ];

    // get the accuracy index for the colors
    const accuracyIdx = Math.max(0, Math.ceil(pct / 25) - 1);
    // get the accuracy in a row (based on 0-7 scale)
    const accuracyInARowIdx = Math.floor(Math.min(7, practiceInARow) / 2);

    let stats =
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
    this.elements.practiceInfoFields.children[7].innerHTML = stats;
  }

  getPgnForMoves(moves) {
    let pgn = "";
    for (let i = 0; i < moves.length; i++) {
      const moveNr = Math.floor(i / 2) + 1;

      if (i % 2 == 0) {
        pgn += (moveNr > 1 ? " " : "") + moveNr + ".";
      }

      //pgn += " " + moves[i].san;
      pgn += " " + moves[i];
    }

    return pgn;
  }

  // show the balloons
  showBalloons() {
    // with default settings
    balloons();
  }

  // run the practice
  async runPractice(_lineIdx = this.practice.lineIdx, _moveIdx = this.practice.moveIdx) {
    // Reset interrupted
    this.practice.isInterrupted = false;

    this.elements.prevMoveButton.disabled = _lineIdx == 0 && _moveIdx == 0;


    // New queued way..
    this.practice.lineIdx = _lineIdx;
    this.practice.moveIdx = _moveIdx;
    this.practice.lastQueuedLine = _lineIdx;
    this.practice.lastQueuedMove = _moveIdx;



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
      this.elements.startPracticeButton.innerHTML = "Start again";

      // If no mistakes, show the balloons
      if (
        parseInt(this.elements.practiceCorrectCounter.innerHTML) > 0 &&
        parseInt(this.elements.practiceFailedCounter.innerHTML) == 0
      ) {
        this.showBalloons();
      }

      return;
    }

    // if the line color changed, we need to reset the board
    const colorChanged =
      this.practice.lineColor !=
      this.practice.lines[this.practice.lineIdx].color;

    // get the line color
    this.practice.lineColor = this.practice.lines[this.practice.lineIdx].color;

    // get the next moves
    const next = this.getMoves();

    // if no more moves or next move for analysis line..
    if (
      (!this.isAutoMove() && next.playable.length == 0) ||
      (this.type == "analysis" && this.practice.moveIdx > 0)
    ) {
      // goto the next line
      this.gotoNextLine(true);

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
    this.elements.pgnNavigationContainer.classList.add("is-hidden");

    // disallow navigation by arrow left/right
    this.setOption(BOARD_SETTINGS.navigation, false);

    // recalibrate the move counter (in case of fast skipping errors)
    if (this.practice.moveIdx == 0) {
      this.elements.practiceMoveCounter.innerHTML = this.practice.moveCount - next.ourMoveCountSoFar;
    }

    // if this is the 1st move in the line
    if (this.practice.moveIdx == 0 || this.practice.animateToPosition) {
      // update the board status
      this.setStatus(BOARD_STATUS.animatingMoves);
      // set the orientation of the board
      const orient = this.practice.lineColor == "white" ? COLOR.white : COLOR.black;
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
          const initialFen = this.practice.lines[this.practice.lineIdx].initialFen
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
          const boardMoves = await this.resetToPosition(
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

              const last = this.game.history({ verbose: true }).pop();
              boardMoves.push(last);
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
              const last = boardMoves.pop();

              // update the board
              await this.board.setPosition(last.before, true);

              // pauseBoard
              // animate the last move
              this.practice._currentAnimatePromise = this.animateMoves(_lineIdx, _moveIdx, [last]);
              // wait for it
              await this.practice._currentAnimatePromise;
              this.practice._currentAnimatePromise = null;
            }
          } else {
            // update the board
            if (boardMoves.length > 0) {
              await this.board.setPosition(boardMoves[0].before, false);
            }

            //await this.animateMoves(history);
            this.practice._currentAnimatePromise = this.animateMoves(_lineIdx, _moveIdx, boardMoves);
            // wait for it
            await this.practice._currentAnimatePromise;
            this.practice._currentAnimatePromise = null;
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
            const last = this.game.history({ verbose: true }).pop();

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

    // If the practice was interrupted
    if (this.practice.isInterrupted) return false;

    // remember the current move number
    this.practice.moveNr = this.game.history().length + 1;

    console.log('Practice - runPractice set moveNr', this.practice.moveNr, this.game.history())

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
          for (let i = 0; i < next.multiple.length; i++) {
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

    // if not interrupted
    if (!this.practice.isInterrupted) {
      // wait on the next move
      this.waitOnMove();
    }
  }

  // get the moves for a certain line/move
  getMoves() {
    let moves = [];
    let playable = [];

    let temp = this.practice.lines[this.practice.lineIdx];
    if (this.type != "analysis") {
      for (let i = 0; i < this.practice.moveIdx; i++) {
        temp = temp.moves[0];
      }
    }

    // get the moves (if any)
    if (temp.moves) {
      for (let i = 0; i < temp.moves.length; i++) {
        moves.push(temp.moves[i]["move"]);
      }

      // get the playable moves (not the autoplay moves)
      for (let i = 0; i < temp.moves.length; i++) {
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
        for (let i = 0; i < this.practice.lineMovesMultiple.length; i++) {
          if (
            !this.practice.lineMovesPlayable.includes(
              this.practice.lineMovesMultiple[i].move
            )
          ) {
            try {
              // get the from & to squares for this move
              this.game.move(this.practice.lineMovesMultiple[i].move);
              const last = this.game.history({ verbose: true }).pop();
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
        const last = this.game.history({ verbose: true }).pop();
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
  async autoMove(goNext = false) {
    // if we have multiple moves or this is an analysis line
    if (this.practice.isMultiple || this.type == "analysis") {
      // goto the next line
      this.gotoNextLine();

      return;
    }

    if (goNext) {
      // goto the next move
      this.practice.moveIdx++;
    }

    // get the next moves
    //let [moves, multiple, playable] = this.getMoves();
    const next = this.getMoves();

    // if any moves to play
    if (next.moves.length > 0) {
      // make the move
      this.game.move(next.moves[0]);
      // get the last move
      const last = this.game.history({ verbose: true }).pop();

      // animate the move
      await this.board.movePiece(last.from, last.to, true);



      // update the pgn history
      this.addMoveToHistory(last);



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
    let cp = null;
    let mate = null;
    let pv = null;

    for (let i = 0; i < this.practice.lineMovesMultiple.length; i++) {
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
          this.undoLastMove();
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
      const nth = ["", "2nd ", "3rd "];
      const msg =
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
          this.undoLastMove();
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
    for (let i = 0; i < moves.length; i++) {
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

    console.log('showCounters', moveCount, this.elements);

    this.elements.practiceCountersContainer.classList.remove("is-hidden");

    this.elements.practiceMoveCounter.innerHTML = moveCount;
    this.elements.practiceCorrectCounter.innerHTML = 0;
    this.elements.practiceFailedCounter.innerHTML = 0;
  }

  // hide the counters
  hideCounters() {
    this.elements.practiceCountersContainer.classList.add("is-hidden");
  }

  // increase the move count
  increaseMoveCount(count = 1) {
    this.elements.practiceMoveCounter.innerHTML =
      parseInt(this.elements.practiceMoveCounter.innerHTML) + count;
  }

  // reduce the move count
  reduceMoveCount(count = 1) {
    this.elements.practiceMoveCounter.innerHTML = Math.max(
      0,
      parseInt(this.elements.practiceMoveCounter.innerHTML) - count
    );
  }

  // add to the correct count
  addCorrectCount() {
    this.elements.practiceCorrectCounter.innerHTML =
      parseInt(this.elements.practiceCorrectCounter.innerHTML) + 1;
  }

  // add to the failed count
  addFailedCount() {
    this.elements.practiceFailedCounter.innerHTML =
      parseInt(this.elements.practiceFailedCounter.innerHTML) + 1;
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
    const url = "/api/repertoire/counters";

    const data = {
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
    this.elements.confirmContainer.classList.add("is-hidden");
    this.elements.warningContainer.classList.add("is-hidden");
    this.elements.infoContainer.classList.remove("is-hidden");
    this.elements.infoContainer.getElementsByTagName("span")[1].innerHTML = status;
  }

  // show a confirmation message
  showConfirm(status = "") {
    this.elements.infoContainer.classList.add("is-hidden");
    this.elements.warningContainer.classList.add("is-hidden");
    this.elements.confirmContainer.classList.remove("is-hidden");
    this.elements.confirmContainer.getElementsByTagName("span")[1].innerHTML = status;
  }

  // show a warning message
  showWarning(status = "") {
    this.elements.infoContainer.classList.add("is-hidden");
    this.elements.confirmContainer.classList.add("is-hidden");
    this.elements.warningContainer.classList.remove("is-hidden");
    this.elements.warningContainer.getElementsByTagName("span")[1].innerHTML = status;
  }

  // show a hint message
  showHint(hint = "") {
    this.elements.hintContainer.classList.remove("is-hidden");
    this.elements.hintContainer.getElementsByTagName("span")[1].innerHTML = hint;
  }

  // hide the hint messages
  hideHint() {
    this.elements.hintContainer.classList.add("is-hidden");
  }

  /**
   * Practice buttons functions.
   * - giveHint
   * - getPieceHint
   * - skipMove
   */

  // give a hint
  giveHint() {
    // blur the button
    this.elements.giveHintButton.blur();
    // if this is the 1st hint
    if (this.hintCounter == 0) {
      // get the hint and show it
      const hint = this.getPieceHint();
      this.showHint(hint);
    } else {
      // get the moves that haven't been played yet
      const notPlayed = this.practice.lineMoves.filter((move) => {
        return this.practice.lineMovesPlayed.indexOf(move) < 0;
      });

      // get the coordinates
      const coords = [];
      for (let i = 0; i < notPlayed.length; i++) {
        if (this.game.move(notPlayed[i])) {
          const last = this.game.history({ verbose: true }).pop();
          coords.push(last);
          this.game.undo();
        }
      }

      // mark the move(s)
      this.board.removeMarkers();
      if (this.hintCounter == 1) {
        for (let i = 0; i < coords.length; i++) {
          this.board.addMarker(MARKER_TYPE.square, coords[i].from);
        }
      } else {
        for (let i = 0; i < coords.length; i++) {
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
    const pieces = {
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
    const notPlayed = this.practice.lineMoves.filter((move) => {
      return this.practice.lineMovesPlayed.indexOf(move) < 0;
    });

    // if all moves have been played
    if (notPlayed.length == 0) {
      return "Bruh..";
    }

    // get the moves per piece
    const moves = [];
    let moveCnt = 0;
    for (let i = 0; i < notPlayed.length; i++) {
      const piece = pieces[notPlayed[i].charAt(0)]
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
    let hint = "";
    let idx = 0;
    for (let prop in moves) {
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
    const fen = line.after ? line.after : line.fen;

    // if we have a line, can we always just use that??
    if (line.line && line.line.length) {
      // get the number of moves
      const total =
        line.line.length + (this.type !== "analysis" && line.move ? 1 : 0);

      return total % 2 == 0 ? "w" : "b";
    }

    // get the color from the FEN
    const parts = fen.split(" ");
    let fenColor = parts[1];

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
    let playableCnt = 0;

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
          let temp = this.practice.lines[curr_lineIdx];
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

      //const color = this.practice.lines[curr_lineIdx].color;
      const color =
        curr_lineIdx >= 0 && curr_lineIdx < this.practice.lines.length
          ? this.practice.lines[curr_lineIdx].color
          : "";

      let temp = this.practice.lines[curr_lineIdx];
      if (this.type != "analysis") {
        for (let i = 0; i < curr_moveIdx; i++) {
          temp = temp.moves[0];
        }
      }

      // get who's turn it is
      const fenColor = this.getTurn(temp);

      // if it's our move

      //if (parts[1] == this.practice.lines[curr_lineIdx].color.substr(0, 1)) {
      if (fenColor == color.substr(0, 1)) {
        // get the moves for this line
        let temp = this.practice.lines[curr_lineIdx];
        if (this.type != "analysis") {
          for (let i = 0; i < curr_moveIdx; i++) {
            temp = temp.moves[0];
          }
        }

        // get the moves (if any)
        if (temp.moves) {
          // get the playable moves (not the autoplay moves)
          for (let i = 0; i < temp.moves.length; i++) {
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
    let playableCnt = 0;
    let playable = [];
    const color =
      curr_lineIdx >= 0 && curr_lineIdx < this.practice.lines.length
        ? this.practice.lines[curr_lineIdx].color
        : "";

    // find the previous playable move
    while (playableCnt == 0) {
      let temp = this.practice.lines[curr_lineIdx];
      if (this.type != "analysis") {
        for (let i = 0; i < curr_moveIdx; i++) {
          temp = temp.moves[0];
        }
      }

      playable = [];

      if (temp.moves) {
        // get the playable moves (not the autoplay moves)
        for (let i = 0; i < temp.moves.length; i++) {
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

      const fen = temp.after ? temp.after : temp.fen;

      const parts = fen.split(" ");

      let fenColor = parts[1];
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
  async prevMove() {
    // blur the button
    this.elements.prevMoveButton.blur();

    // get the previous move values
    const [prevLine, prevMove, playableCount] = this.getPrevMove(
      this.practice.lastQueuedLine,
      this.practice.lastQueuedMove
    );

    // Current practice run?
    const isCurrent = this.practice.lastQueuedLine == this.practice.lineIdx && this.practice.lastQueuedMove == this.practice.moveIdx;

    // re-add any moves played in current position
    let increaseCount = isCurrent ? this.practice.lineMovesPlayed.length : 0;
    // add playable moves count from previous move
    increaseCount += playableCount;

    // update the move counter
    this.increaseMoveCount(increaseCount);


    // If we have a valid line
    if (prevLine >= 0) {
      // animate to the next position
      this.practice.animateToPosition = true;
      this.practice.animateFromBeginning = false;

      /*

      -- move to runPractice?

      // remove all markers
      this.board.removeMarkers();
      // remove arrows
      this.board.removeArrows();
      */

      // Enqueue the practice run
      this.enqueueRun(prevLine, prevMove, true);
    }
  }

  // skip the current move
  async skipMove() {
    // blur the button
    this.elements.skipMoveButton.blur();
    // if practice was paused
    if (this.practice.paused) {
      // continue practice
      this.continuePractice();

      return;
    }

    // Get the last queued line/move
    const lastQueuedLine = this.practice.lastQueuedLine;
    const lastQueuedMove = this.practice.lastQueuedMove;

    // Get the next move values
    const [nextLine, nextMove, playable] = this.getNextMove(
      lastQueuedLine,
      lastQueuedMove
    );

    // Current practice run?
    const isCurrent = this.practice.lastQueuedLine == this.practice.lineIdx && this.practice.lastQueuedMove == this.practice.moveIdx;

    // Get the reduce count (total moves minus already played moves, if current)
    const reduceCount = isCurrent
      ? (this.practice.lineMovesMultiple.length > 1
        ? this.practice.lineMovesMultiple.length
        : this.practice.lineMoves.length) - this.practice.lineMovesPlayed.length
      : playable.length;

    // update the move counter
    this.reduceMoveCount(reduceCount);

    // animate to the next position
    this.practice.animateToPosition = true;
    this.practice.animateFromBeginning = false;

    /*

    -- maybe move this to runPractice ??

    // remove all markers
    this.board.removeMarkers();
    // remove arrows
    this.board.removeArrows();
    */

    // Enqueue the practice run
    this.enqueueRun(nextLine, nextMove, true);
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
    while (this.elements.playedMovesList.lastChild) {
      this.elements.playedMovesList.removeChild(this.elements.playedMovesList.firstChild);
    }

    // add the rows for the moves
    for (let i = 0; i < count; i++) {
      let row = document.createElement("div");
      row.className =
        "is-flex is-justify-content-space-between is-align-items-center px-2 py-3" +
        (i + 1 == count
          ? ""
          : " border-b border-tacao-300/60 dark:border-slate-800");

      let cell = document.createElement("div");
      cell.className = "tc-sharp";
      cell.innerHTML = Math.ceil(this.practice.moveNr / 2) + ". _";

      row.appendChild(cell);

      cell = document.createElement("div");
      cell.className =
        "is-hidden cursor-pointer px-2 py-1 is-size-7 rounded-full";
      cell.innerHTML = "";

      row.appendChild(cell);

      this.elements.playedMovesList.appendChild(row);
    }

    // set the label
    this.elements.playedMovesContainer.children[0].innerHTML =
      count > 1 ? "Moves" : "Move";

    // show the moves list
    this.elements.playedMovesContainer.classList.remove("is-hidden");
  }

  // hide the played moves container
  hidePlayedMoves() {
    this.elements.playedMovesContainer.classList.add("is-hidden");
  }

  // add a move to the played moves container
  setPlayedMove(index, move, cp = null, mate = null, line = []) {
    // set the CP eval
    const cpEval =
      cp !== null
        ? '&nbsp;<sup class="is-size-7 has-text-faded">' +
        (cp >= 0 ? "+" : "") +
        Math.round(cp) / 100 +
        "</sup>"
        : mate !== null
          ? '&nbsp;<sup class="is-size-7 has-text-faded">M' + mate + "</sup>"
          : "";
    // set the move
    this.elements.playedMovesList.children[index].children[0].innerHTML =
      Math.ceil(this.practice.moveNr / 2) + ". " + move + cpEval;

    // add the show line link
    if (line && line.length > 0) {
      this.elements.playedMovesList.children[index].children[1].innerHTML = "show line";
      this.elements.playedMovesList.children[index].children[1].classList.remove(
        "is-hidden"
      );

      // add the click handler
      this.elements.playedMovesList.children[index].children[1].addEventListener(
        "click",
        (event) => {
          event.preventDefault();

          // add the variation
          const variation = this.addVariation(this.practice.moveNr, line);

          // update the pgn field
          this.updatePgnField();


          // if the practice is paused
          if (this.practice.paused) {
            // goto the move
            //this.gotoMove(this.practice.moveNr, variation);
          }
        }
      );
    }
  }
}

// initialise the Practice object once the page is loaded
document.addEventListener("DOMContentLoaded", (event) => {
  const practice = new Practice();
});

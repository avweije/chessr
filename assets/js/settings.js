import { MyChess } from "chess";
import { Chessboard, FEN } from "../cm-chessboard/src/Chessboard.js";
import {
  COLOR,
  INPUT_EVENT_TYPE,
} from "../cm-chessboard/src/view/ChessboardView.js";
import {
  MARKER_TYPE,
  Markers,
} from "../cm-chessboard/src/extensions/markers/Markers.js";
import { Utils } from "utils";
import { Modal } from "modal";

import "../styles/chessboard.css";
import { CUSTOM_MARKER_TYPE, PIECE_TILESIZE } from "chessboard";
import {
  ARROW_TYPE,
  Arrows,
} from "../cm-chessboard/src/extensions/arrows/Arrows.js";

import { CUSTOM_ARROW_TYPE, ThickerArrows } from "ThickerArrows";

/**
 * Controller class for the settings page.
 */
class Settings {
  tabs = {
    buttons: null,
    board: null,
    engine: null,
    practice: null,
    account: null,
  };

  unlockEmailAddressButton = null;
  accountConfirmContainer = null;
  sendVerificationEmailButton = null;

  board = null;
  boardElement = null;

  boardThemeSelect = null;
  boardPiecesSelect = null;
  animationDurationInput = null;
  repertoireEngineTimeInput = null;
  animateVariationCheckbox = null;
  recommendIntervalInput = null;
  analyseEngineTimeInput = null;
  analyseIgnoreInaccuracyCheckbox = null;
  analyseMistakeToleranceInput = null;
  accountEmailAddress = null;

  settings = [];

  animateInProgress = false;
  animateCancel = false;
  animateCounter = 0;

  constructor() {
    // get the elements
    this.tabs.buttons = document.getElementById("settingsTabButtons");
    this.tabs.account = document.getElementById("settingsTabAccount");
    this.tabs.board = document.getElementById("settingsTabBoard");
    this.tabs.engine = document.getElementById("settingsTabEngine");
    this.tabs.practice = document.getElementById("settingsTabPractice");

    this.accountEmailAddress = document.getElementById("accountEmailAddress");
    this.unlockEmailAddressButton = document.getElementById(
      "unlockEmailAddressButton"
    );
    this.accountConfirmContainer = document.getElementById(
      "accountConfirmContainer"
    );
    this.sendVerificationEmailButton = document.getElementById(
      "sendVerificationEmailButton"
    );

    this.boardElement = document.getElementById("board");
    this.boardThemeSelect = document.getElementById("boardThemeSelect");
    this.boardPiecesSelect = document.getElementById("boardPiecesSelect");
    this.animationDurationInput = document.getElementById(
      "animationDurationInput"
    );
    this.repertoireEngineTimeInput = document.getElementById(
      "repertoireEngineTimeInput"
    );
    this.animateVariationCheckbox = document.getElementById(
      "animateVariationCheckbox"
    );
    this.recommendIntervalInput = document.getElementById(
      "recommendIntervalInput"
    );
    this.analyseEngineTimeInput = document.getElementById(
      "analyseEngineTimeInput"
    );
    this.analyseIgnoreInaccuracyCheckbox = document.getElementById(
      "analyseIgnoreInaccuracyCheckbox"
    );
    this.analyseMistakeToleranceInput = document.getElementById("analyseMistakeTolerance");

    // add event listeners
    this.tabs.buttons.children[0].children[0].addEventListener(
      "click",
      this.onSwitchTab.bind(this)
    );
    this.tabs.buttons.children[1].children[0].addEventListener(
      "click",
      this.onSwitchTab.bind(this)
    );
    this.tabs.buttons.children[2].children[0].addEventListener(
      "click",
      this.onSwitchTab.bind(this)
    );
    this.tabs.buttons.children[3].children[0].addEventListener(
      "click",
      this.onSwitchTab.bind(this)
    );

    // toggle send email button on email address change
    this.accountEmailAddress.addEventListener("input", () => {
      if (
        this.accountEmailAddress.value == "" ||
        this.accountEmailAddress.value == this.settings.email
      ) {
        this.accountConfirmContainer.classList.remove("opacity-100");
        this.accountConfirmContainer.classList.add("is-hidden");
      } else {
        this.accountConfirmContainer.classList.add("opacity-100");
        this.accountConfirmContainer.classList.remove("is-hidden");
      }
    });
    // unlock email address input
    this.unlockEmailAddressButton.addEventListener("click", () => {
      this.accountEmailAddress.disabled = false;
      this.unlockEmailAddressButton.classList.add("is-hidden");
    });
    // send verification email
    this.sendVerificationEmailButton.addEventListener(
      "click",
      this.sendVerificationEmail.bind(this)
    );

    this.boardThemeSelect.addEventListener(
      "change",
      this.onChangeBoardSettings.bind(this)
    );
    this.boardPiecesSelect.addEventListener(
      "change",
      this.onChangeBoardSettings.bind(this)
    );
    this.animationDurationInput.addEventListener(
      "change",
      this.onChangeAnimationDuration.bind(this)
    );
    this.repertoireEngineTimeInput.addEventListener(
      "change",
      this.updateSettings.bind(this)
    );
    this.animateVariationCheckbox.addEventListener(
      "change",
      this.updateSettings.bind(this)
    );
    this.recommendIntervalInput.addEventListener(
      "change",
      this.updateSettings.bind(this)
    );
    this.analyseEngineTimeInput.addEventListener(
      "change",
      this.updateSettings.bind(this)
    );
    this.analyseIgnoreInaccuracyCheckbox.addEventListener(
      "change",
      this.updateSettings.bind(this)
    );
    this.analyseMistakeToleranceInput.addEventListener(
      "change",
      this.updateSettings.bind(this)
    );

    // get the settings
    this.getSettings();
  }

  // switch tabs
  onSwitchTab() {
    this.tabs.board.classList.add("is-hidden");
    this.tabs.engine.classList.add("is-hidden");
    this.tabs.practice.classList.add("is-hidden");
    this.tabs.account.classList.add("is-hidden");

    if (this.tabs.buttons.children[0].children[0].checked) {
      this.tabs.board.classList.remove("is-hidden");
    }
    if (this.tabs.buttons.children[1].children[0].checked) {
      this.tabs.engine.classList.remove("is-hidden");
    }
    if (this.tabs.buttons.children[2].children[0].checked) {
      this.tabs.practice.classList.remove("is-hidden");
    }
    if (this.tabs.buttons.children[3].children[0].checked) {
      this.tabs.account.classList.remove("is-hidden");
    }
  }

  // send the verification email
  sendVerificationEmail() {
    console.info("sendVerificationEmail");
  }

  // switch board theme
  onChangeBoardSettings(event) {
    // update the chessboard
    this.createChessboard(
      this.boardThemeSelect.value,
      this.boardPiecesSelect.value,
      this.animationDurationInput.value
    );
    // update the settings
    this.updateSettings();
  }

  // called when animation duration slider changes value
  onChangeAnimationDuration(event) {
    // cancel the current animation
    this.animateCancel = true;
    // update the board & the settings
    this.onChangeBoardSettings();
    // increase the animate id
    this.animateCounter++;
    // start the animation
    this.startAnimation();
  }

  // start the piece animation
  startAnimation() {
    // if already in progress
    if (this.animateInProgress) {
      // cancel the current animation
      this.animateCancel = true;
      // start the animation after a short pause
      setTimeout(() => {
        this.runAnimation(this.animateCounter);
      }, 500);
    } else {
      this.runAnimation(this.animateCounter);
    }
  }

  // run an animation
  async runAnimation(animateId) {
    // if we need to run this animation
    if (animateId !== this.animateCounter) {
      return false;
    }

    // the moves we're going to animate
    var moves = [
      "e4",
      "c5",
      "c3",
      "Nf6",
      "e5",
      "Nd5",
      "Nf3",
      "d6",
      "Bb5+",
      "Bd7",
      "Bc4",
      "Nb6",
      "Bxf7+",
      "Kxf7",
      "e6+",
      "Bxe6",
      "Ng5+",
      "Kf6",
      "Qf3+",
      "Kxg5",
      "h4+",
      "Kg6",
      "h5+",
      "Kh6",
      "Qe3+",
      "g5",
      "Qxe6+",
      "Kg7",
      "h6#",
    ];

    this.animateInProgress = true;
    this.animateCancel = false;

    try {
      // create a new game
      var game = new MyChess();
      // set the board position
      this.board.setPosition(game.fen());
      // animate the moves 1 by 1
      for (var i = 0; i < moves.length; i++) {
        // make the move and get the info
        game.move(moves[i]);
        var last = game.history({ verbose: true }).pop();

        // animate the move
        await this.board.movePiece(last.from, last.to, true);

        // if we need to stop animating
        if (this.animateCancel) {
          this.animateCancel = false;
          break;
        }

        // update the board (in case of castling)
        this.board.setPosition(last.after);
      }
    } catch (err) {
      console.error(err);
    } finally {
      this.animateInProgress = false;
    }
  }

  // get the settings
  getSettings() {
    // show the page loader
    Utils.showLoading();

    // show
    var url = "/api/settings";

    fetch(url, {
      method: "GET",
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:");
        console.log(response);

        // store the settings
        this.onGetSettings(response.settings);
      })
      .catch((error) => {
        console.error("Error:", error);
        // show the error icon
        Utils.showError();
      })
      .finally(() => {
        // hide the page loader
        Utils.hideLoading();
      });
  }

  onGetSettings(settings) {
    // store the settings
    this.settings = settings;

    // update the inputs with the settings
    this.accountEmailAddress.value = settings.email;

    if (settings.board) {
      this.boardThemeSelect.value = settings.board;
    }
    if (settings.pieces) {
      this.boardPiecesSelect.value = settings.pieces;
    }

    this.animationDurationInput.value = settings.animation_duration;
    this.repertoireEngineTimeInput.value = settings.repertoire_engine_time;
    this.animateVariationCheckbox.checked = settings.animate_variation;
    this.recommendIntervalInput.value = settings.recommend_interval;
    this.analyseEngineTimeInput.value = settings.analyse_engine_time;
    this.analyseIgnoreInaccuracyCheckbox.checked =
      settings.analyse_ignore_inaccuracy;
    this.analyseMistakeToleranceInput.value = settings.analyse_mistake_tolerance;

    // update the range input titles
    this.updateRangeInputTitles();

    // create the chess board
    this.createChessboard(
      this.boardThemeSelect.value,
      this.boardPiecesSelect.value,
      this.animationDurationInput.value
    );
  }

  // update the range input titles
  updateRangeInputTitles() {
    var m = Math.floor(parseInt(this.repertoireEngineTimeInput.value) / 60);
    var s = parseInt(this.repertoireEngineTimeInput.value) - m * 60;

    this.animationDurationInput.title =
      this.animationDurationInput.value + "ms";
    this.repertoireEngineTimeInput.title =
      m > 0 ? m + "m " + (s > 0 ? s + "s" : "") : s + "s";
    this.analyseEngineTimeInput.title =
      parseInt(this.analyseEngineTimeInput.value) == 500
        ? this.analyseEngineTimeInput.value + "ms"
        : parseInt(this.analyseEngineTimeInput.value) / 1000 + "s";
    this.recommendIntervalInput.title = ["Less", "Average", "More", "Most"][
      parseInt(this.recommendIntervalInput.value)
    ];
  }

  // update the settings
  updateSettings() {
    var url = "/api/settings";

    // update the range input titles
    this.updateRangeInputTitles();

    // set the data object
    var data = {
      settings: {
        board: this.boardThemeSelect.value,
        pieces: this.boardPiecesSelect.value,
        animation_duration: this.animationDurationInput.value,
        repertoire_engine_time: this.repertoireEngineTimeInput.value,
        animate_variation: this.animateVariationCheckbox.checked,
        recommend_interval: this.recommendIntervalInput.value,
        analyse_engine_time: this.analyseEngineTimeInput.value,
        analyse_ignore_inaccuracy: this.analyseIgnoreInaccuracyCheckbox.checked,
        analyse_mistake_tolerance: this.analyseMistakeToleranceInput.value
      },
    };

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
        console.error("Error:", error);
        // show the error icon
        Utils.showError();
      });
  }

  // create or update the chessboard
  createChessboard(
    cssClass = "chess-club",
    piecesFile = "standard.svg",
    animationDuration = 300
  ) {
    try {
      // if we are updating
      if (this.board) {
        // destroy the current board
        this.board.destroy();
        this.board = null;
      }

      // get the correct tileSize
      var tileSize = PIECE_TILESIZE.get(piecesFile);

      // create the chess board
      this.board = new Chessboard(this.boardElement, {
        position: FEN.start,
        orientation: COLOR.white,
        assetsUrl: "/assets/", // wherever you copied the assets folder to, could also be in the node_modules folder
        assetsCache: false,
        style: {
          cssClass: cssClass, // set the css theme of the board, try "green", "blue" or "chess-club"
          showCoordinates: true, // show ranks and files
          aspectRatio: 1, // height/width of the board
          pieces: {
            file: "pieces/" + piecesFile, // the filename of the sprite in `assets/pieces/` or an absolute url like `https://…` or `/…`
            tileSize: tileSize,
          },
          animationDuration: animationDuration, // pieces animation duration in milliseconds. Disable all animations with `0`
        },
        extensions: [
          {
            class: Markers,
            props: { sprite: "extensions/markers/markers.svg" },
          },
          { class: ThickerArrows },
        ],
      });

      /*
      this.board.addMarker(MARKER_TYPE.bevel, "a4");
      this.board.addMarker(MARKER_TYPE.bevel, "b4");

      this.board.addMarker(MARKER_TYPE.circle, "c4");
      this.board.addMarker(MARKER_TYPE.circle, "d4");

      this.board.addMarker(MARKER_TYPE.dot, "g4");
      this.board.addMarker(MARKER_TYPE.dot, "h4");

      this.board.addMarker(MARKER_TYPE.frame, "a6");
      this.board.addMarker(MARKER_TYPE.frame, "b6");

      this.board.addMarker(MARKER_TYPE.square, "h6");
      this.board.addMarker(MARKER_TYPE.square, "g6");

      this.board.addArrow(ARROW_TYPE.pointy, "d2", "d3");
      this.board.addArrow(CUSTOM_ARROW_TYPE.normal, "d4", "f5");
      this.board.addArrow(CUSTOM_ARROW_TYPE.thick, "e4", "g5");
      this.board.addArrow(CUSTOM_ARROW_TYPE.thicker, "f4", "h5");

      console.info(this.board.getArrows());
      */
    } catch (err) {
      console.error(err);
    }
  }
}

document.addEventListener("DOMContentLoaded", (event) => {
  var settings = new Settings();
});

import { MyChess } from "./chess.js";
import { Chessboard, FEN } from "cm-chessboard/src/Chessboard.js";
import {
  COLOR,
  INPUT_EVENT_TYPE,
} from "cm-chessboard/src/view/ChessboardView.js";
import { Utils } from "./utils.js";
import { Modal } from "./modal.js";

import "../styles/chessboard.css";
import { PIECE_TILESIZE } from "./chessboard.js";

/**
 * Controller class for the settings page.
 */
class Settings {
  board = null;
  boardElement = null;

  boardThemeSelect = null;
  boardPiecesSelect = null;
  animationDurationInput = null;
  repertoireEngineTimeInput = null;
  animateVariationCheckbox = null;
  analyseEngineTimeInput = null;
  analyseIgnoreInaccuracyCheckbox = null;

  settings = [];

  animateInProgress = false;
  animateCancel = false;
  animateCounter = 0;

  constructor() {
    // get the elements
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
    this.analyseEngineTimeInput = document.getElementById(
      "analyseEngineTimeInput"
    );
    this.analyseIgnoreInaccuracyCheckbox = document.getElementById(
      "analyseIgnoreInaccuracyCheckbox"
    );

    // add event listeners
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
    this.analyseEngineTimeInput.addEventListener(
      "change",
      this.updateSettings.bind(this)
    );
    this.analyseIgnoreInaccuracyCheckbox.addEventListener(
      "change",
      this.updateSettings.bind(this)
    );

    // get the settings
    this.getSettings();
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
      });
  }

  onGetSettings(settings) {
    // store the settings
    this.settings = settings;

    // update the inputs with the settings
    if (settings.board) {
      this.boardThemeSelect.value = settings.board;
    }
    if (settings.pieces) {
      this.boardPiecesSelect.value = settings.pieces;
    }

    this.animationDurationInput.value = settings.animation_duration;
    this.repertoireEngineTimeInput.value = settings.repertoire_engine_time;
    this.animateVariationCheckbox.checked = settings.animate_variation;
    this.analyseEngineTimeInput.value = settings.analyse_engine_time;
    this.analyseIgnoreInaccuracyCheckbox.checked =
      settings.analyse_ignore_inaccuracy;

    // create the chess board
    this.createChessboard(
      this.boardThemeSelect.value,
      this.boardPiecesSelect.value,
      this.animationDurationInput.value
    );
  }

  // update the settings
  updateSettings() {
    var url = "/api/settings";

    var data = {
      settings: {
        board: this.boardThemeSelect.value,
        pieces: this.boardPiecesSelect.value,
        animation_duration: this.animationDurationInput.value,
        repertoire_engine_time: this.repertoireEngineTimeInput.value,
        animate_variation: this.animateVariationCheckbox.checked,
        analyse_engine_time: this.analyseEngineTimeInput.value,
        analyse_ignore_inaccuracy: this.analyseIgnoreInaccuracyCheckbox.checked,
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
        assetsUrl: "/build/", // wherever you copied the assets folder to, could also be in the node_modules folder
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
      });
    } catch (err) {
      console.error(err);
    }
  }
}

document.addEventListener("DOMContentLoaded", (event) => {
  var settings = new Settings();
});

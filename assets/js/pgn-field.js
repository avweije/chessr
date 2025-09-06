import { MyChess } from "chess";


/**
 * PgnField class that renders a PGN in a container using text or links.
 * Keeps track of the history of moves for a main line and optionally for 1 or more variations.
 * Keeps track of the current move.
 * Offers functions for navigation that fire callbacks for synchronizing.
 * 
 * @param {element} container - The container where the PGN will be rendered.
 * @param {object} options    - The options for the PgnField. See default options.
 * @param {object} handlers   - The event handlers to call when navigating. See event handlers.
 */
export class PgnField {
  pgnField = null;

  game = null;

  initialFen = "";
  currentMove = 0;
  currentVariation = -1;

  history = [];
  variations = [];

  handlers = {};
  options = {};

  // The default options
  static defaultOptions = {
    navigationEnabled: true,   // Adds event listeners for left & right arrow keys for navigating the pgn
    useVariations: true,       // Allows the use of variations
    withLinks: true,           // Uses links in the pgn for navigation
    useTextForLastMove: false, // Uses text for the last move if withLinks is set to true
    highlightLastMove: true,   // Highlight the last move if it's the current one
    emptyText: null,           // Optionally display an empty text when there are no moves instead of '1.'
    pauseUpdate: false         // Temporarily pause the updating of the pgn field
  };

  /**
   * 
   * @param {*} param0 
   */
  constructor({
    container = null,
    options = {},
    handlers = {}
  }) {
    // Store the container
    this.pgnField = container;
    // Store the options
    this.options = { ...PgnField.defaultOptions, ...options };
    // Store the handlers
    const defaultHandlers = {
      onGotoMove: () => { }
    };

    this.handlers = { ...defaultHandlers, ...handlers };

    // Create the chess game
    this.game = new MyChess();

    // Add the keyboard navigation event listeners
    document.addEventListener("keydown", (event) => {
      // If navigation is enabled and arrow left/right was hit
      if (
        this.options.navigationEnabled &&
        (['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(event.key)) &&
        (!document.activeElement ||
          !["INPUT", "SELECT", "TEXTAREA"].includes(
            document.activeElement.nodeName
          ))
      ) {
        // Navigate to next or previous
        switch (event.key) {
          case 'ArrowRight':
            this.gotoNext();
            break;
          case 'ArrowLeft':
            this.gotoPrevious();
            break;
          case 'ArrowUp':
            this.gotoFirst();
            break;
          case 'ArrowDown':
            this.gotoLast();
            break;
        }
      }
    });
  }

  /**
   * Overrides the current container element.
   * 
   * @param {element} container - The new container element for the PGN.
   */
  setContainer(container) {
    this.pgnField = container;
  }

  /**
   * Update 1 or several options during runtime.
   * 
   * @param {object} options - One or several options to override. See default options.
   */
  setOptions(options = {}) {
    for (const [key, value] of Object.entries(options)) {
      if (!(key in PgnField.defaultOptions)) {
        throw new Error(`Invalid option: "${key}"`);
      }
      this.options[key] = value;
    }
  }


  /**
   * Resets the game history and makes the moves. Clears variations and resets the current move to the 1st.
   * 
   * @param {string} fen  - The intiial starting position.
   * @param {array} moves - The moves to make after resetting.
   */
  _resetWithMoves(fen, moves = []) {
    // reset the game
    this.game.reset();
    // load the fen
    if (fen != "") this.game.load(fen);

    // wrap in try catch ??

    // make the moves
    for (let i = 0; i < moves.length; i++) {
      this.game.move(moves[i]);
    }

    this.history = this.game.history({ verbose: true });
    this.variations = [];

    // current move last sometimes? maybe through parameter..
    this.currentMove = 0;
    this.currentVariation = -1;
  }

  /**
   * Resets the game history and optionally makes moves after resetting.
   * 
   * @param {string} fen  - The initial starting position.
   * @param {array} moves - The moves to make after resetting.
   */
  reset(fen = "", moves = []) {

    console.log("pgnField.reset", fen, moves);

    // reset the game and make the moves to get the correct history
    this._resetWithMoves(fen, moves);

    //console.log('PgnField - reset moves', moves);

    // we need to make the moves if we want to use this.game

    // update the pgn field
    this.updatePgnField();
  }

  /**
   * Reset to the current game history. Needs to be passed from chessboard.js.
   * Updates the current move to last move.
   * 
   * @param {*} fen 
   */
  resetToCurrent(fen = "", moves = []) {
    // reset the game and make the moves to get the correct history
    this._resetWithMoves(fen, moves);

    console.log('PgnField - resetToCurrent', fen, this.history);

    // Update the current move to the last move
    this.currentMove = this.history.length;

    // update the pgn field
    this.updatePgnField();
  }

  /**
   * Resets to a certain move number. Removes history after that. 
   * Resets variations and sets the current move to the last move.
   * 
   * @param {int} moveNr - The move number to reset to.
   */
  resetTo(moveNr) {

    //console.log('PgnField - resetTo history', this.game.history({ verbose: true }));

    // remove the last move until we reach moveNr
    while (this.game.history().length > moveNr) {
      this.removeLast();
    }
    // reset the history and variations
    this.history = this.game.history({ verbose: true });

    this.variations = [];
    this.currentMove = this.history.length;
    this.currentVariation = -1;
    // update the pgn field
    this.updatePgnField();
  }

  /**
   * Remove the last move. Undoes the last game move.
   */
  removeLast() {
    // undo the move
    this.game.undo();
    // remove from history or variation
    if (this.currentVariation == -1) {
      this.history.pop();
    } else {
      this.variations[this.currentVariation].moves.pop();
      if (this.variations[this.currentVariation].moves.length == 0) {
        this.variations.splice(this.currentVariation, 1);
        this.currentVariation = -1;
      }
    }
    // update the current move
    this.currentMove = this.game.history().length;
    // update the pgn field
    this.updatePgnField();
  }

  /**
   * Returns true if the current move is the 1st move.
   * 
   * @returns {bool}
   */
  isFirst() {

    console.log('PgnField - isFirst', this.currentMove, this.history.length);
  
    // make sure we have the currentMove
    this.currentMove = this.currentMove == -1 ? this.history.length : this.currentMove;

    return this.currentMove == 0;
  }

  /**
   * Returns true if the current move is the last move in the current line or variation.
   * 
   * @returns {bool}
   */
  isLast() {
    // make sure we have the currentMove
    this.currentMove = this.currentMove == -1 ? this.history.length : this.currentMove;

    // make sure the current variation is valid
    if (
      this.currentVariation >= 0 &&
      this.currentVariation >= this.variations.length
    ) {
      this.currentVariation = -1;
    }

    if (this.currentVariation >= 0) {
      if (this.variations[this.currentVariation].moveNr < this.history.length) {
        return false;
      }

      return (
        this.currentMove ==
        this.variations[this.currentVariation].moveNr +
        this.variations[this.currentVariation].moves.length -
        1
      );
    } else {
      return this.currentMove == this.history.length;
    }
  }

  /**
   * Jumps to a certain move in the current history. Leaves history in tact.
   * Returns the moves to make to get to the new position.
   * 
   * @param {int} moveNr         - The move number to jump to.
   * @param {int} variationIdx   - The variation to jump to.
   * @param {bool} afterGotoMove - If this is the current move, optionally call afterGotoMove.
   * @returns 
   */
  gotoMove(moveNr, variationIdx = -1, afterGotoMove = true) {
    let moves = [];

    // safety, 1st move minimum
    moveNr = Math.max(0, moveNr);

    console.info("PgnField - gotoMove", moveNr, variationIdx);

    // make sure the variation index is correct
    if (variationIdx >= 0) {
      // if the variation does not exist
      if (variationIdx >= this.variations.length) {
        return false;
      }

      // if the move lies after the variation
      if (
        moveNr >
        this.variations[variationIdx].moveNr +
        this.variations[variationIdx].moves.length
      ) {
        return false;
      }

      // if the move lies before the variation, goto the parent variation
      while (
        variationIdx >= 0 &&
        moveNr < this.variations[variationIdx].moveNr
      ) {
        variationIdx =
          this.variations[variationIdx].parent == null
            ? -1
            : this.variations[variationIdx].parent;
      }
    }

    // safety, last move maximum
    if (variationIdx >= 0) {
      moveNr = Math.min(
        moveNr,
        this.variations[variationIdx].moveNr -
        1 +
        this.variations[variationIdx].moves.length
      );
    } else {
      moveNr = Math.min(moveNr, this.history.length);
    }

    // if this is the same move, no need to make it again..
    if (moveNr == this.currentMove && variationIdx == this.currentVariation) {
      // call the afterGotoMove handler
      if (afterGotoMove) {
        this.handlers.onGotoMove(moveNr, variationIdx);
      }

      return true;
    }

    // remember the current move & variation
    this.currentMove = moveNr;
    this.currentVariation = variationIdx;

    //console.log('PgnField gotoMove - currentMove: ', this.currentMove, this.currentVariation);

    // if this is a main line move
    if (variationIdx == -1) {
      // get the moves
      moves = this.history.slice(0, moveNr);
    } else {
      // get the 1st move of the top (parent) variation
      let varStart = this.variations[variationIdx].moveNr;
      // get all the parent-variations, top level 1st
      let parent = this.variations[variationIdx].parent;
      const parents = [];
      while (parent !== null) {
        // add to the beginning of the parents array
        parents.splice(0, 0, parent);

        varStart = this.variations[parent].moveNr;
        parent = this.variations[parent].parent;
      }

      // get the main line moves
      moves = this.history.slice(0, varStart - 1);

      // add the parent(s) variation moves
      for (let i = 0; i < parents.length; i++) {
        let varEnd =
          parents.length > i + 1
            ? this.variations[parents[i + 1]].moveNr
            : this.variations[variationIdx].moveNr;

        moves = moves.concat(
          this.variations[parents[i]].moves.slice(
            0,
            varEnd - this.variations[parents[i]].moveNr
          )
        );
      }

      // add the variation moves
      moves = moves.concat(
        this.variations[variationIdx].moves.slice(
          0,
          moveNr - this.variations[variationIdx].moveNr + 1
        )
      );
    }

    //console.log("PgnField - gotoMove - moves to make:", moves);

    // update the PGN field
    this.updatePgnField();

    // call the afterGotoMove handler
    //if (afterGotoMove) {
    this.handlers.onGotoMove(moveNr, variationIdx, moves);
    //}

    return moves;
  }

  /**
   * Goto the first move in the current line or variation.
   */
  gotoFirst() {
    this.gotoMove(0);
  }

  /**
   * Goto the last move in the current line or variation.
   */
  gotoLast() {
    this.gotoMove(this.history.length);
  }

  /**
   * Goto the previous move in the current line or variation.
   */
  gotoPrevious() {
    // make sure we have the currentMove
    this.currentMove =
      this.currentMove == -1 ? this.history.length : this.currentMove;

    let gotoMove = this.currentMove - 1;

    // if we are on the 1st move of a variation
    if (
      this.currentVariation >= 0 &&
      this.currentVariation < this.variations.length &&
      this.currentMove == this.variations[this.currentVariation].moveNr
    ) {
      gotoMove = gotoMove + 1;
    }

    this.gotoMove(gotoMove, this.currentVariation, false);
  }

  /**
   * Goto the next move in the current line or variation.
   */
  gotoNext() {
    // make sure we have the currentMove
    this.currentMove =
      this.currentMove == -1 ? this.history.length : this.currentMove;

    this.gotoMove(this.currentMove + 1, this.currentVariation, false);
  }

  /**
   * Adds a move to the game history. Sets the current move to this move.
   * 
   * @param {move} move 
   */
  addMoveToHistory(move) {

    console.info("PgnField.addMoveToHistory", move, this.game.history());

    try {

      // make the move
      move = this.game.move(move);

      // get the move we just made
      //move = this.game.history({ verbose: true }).pop();

      // get the current move index
      //const moveNr = this.game.moveNumber();
      const moveNr = this.game.history().length;

      console.log("PgnField addMoveToHistory - moveNr:", moveNr, this.currentVariation);

      // if we are in the main line
      if (this.currentVariation == -1) {
        // if this is a new move
        if (this.history.length < moveNr) {
          // add the move to the main line
          this.history.push(move);
        } else {
          //

          if (this.options.useVariations) {
            //
            let addVariation = true;
            //
            for (let i = 0; i < this.variations.length; i++) {
              if (this.variations[i].moveNr == moveNr) {
                //
                if (this.variations[i].moves[0].san == move.san) {
                  // set the current variation
                  this.currentVariation = this.variations.length - 1;

                  addVariation = false;
                  break;
                }
              }
            }

            //
            if (addVariation) {
              // add a new main line variation
              this.variations.push({
                moveNr: moveNr,
                parent: null,
                moves: [move],
              });

              // set the current variation
              this.currentVariation = this.variations.length - 1;
            }
          } else {
            // overwrite the main line and add the new move
            this.history.splice(moveNr - 1, this.history.length, move);
          }
        }
      } else {
        // if this is a new move for the variation
        if (
          this.variations[this.currentVariation].moveNr -
          1 +
          this.variations[this.currentVariation].moves.length <
          moveNr
        ) {
          // add the move to the current variation
          this.variations[this.currentVariation].moves.push(move);
        } else {
          //
          // check if the move matches the variation move
          // if not, add new variation
          //

          // if this is a different move
          if (
            this.variations[this.currentVariation].moves[
              moveNr - this.variations[this.currentVariation].moveNr
            ].san != move.san
          ) {
            // add a new sub-variation
            this.variations.push({
              moveNr: moveNr,
              parent: this.currentVariation,
              moves: [move],
            });

            // set the current variation
            this.currentVariation = this.variations.length - 1;
          }
        }
      }

      //console.log('PgnField currentMove:', moveNr, this.history);

      //
      this.currentMove = moveNr;

      // update the pgn field
      this.updatePgnField();
    } catch (err) {
      console.warn(err);
    }
  }

  /**
   * Adds a variation at the specified move number.
   * 
   * @param {int} moveNr  - The move number at which to add the variation.
   * @param {array} moves - The moves for the variation.
   * @returns 
   */
  addVariation(moveNr, moves) {

    console.info("addVariation", moveNr, moves);

    let currVar = -1;
    let match = true;
    // loop through the moves
    for (let i = 0; i < moves.length; i++) {
      let ii = moveNr - 1 + i;
      // if no more history or (current) variation moves
      if (
        !match ||
        (currVar == -1 && this.history.length <= ii) ||
        (currVar >= 0 &&
          this.variations[currVar].moveNr -
          1 +
          this.variations[currVar].moves.length <=
          ii)
      ) {

        continue;
      }

      // if the history move does not match
      if (currVar == -1 && this.history[ii].san !== moves[i]) {
        // not a match, check main line variations
        for (let x = 0; x < this.variations.length; x++) {
          if (
            this.variations[x].parent == null &&
            this.variations[x].moveNr == ii + 1 &&
            this.variations[x].moves[0].san == moves[i]
          ) {
            // move found in main line variation
            currVar = x;

            break;
          }
        }

        // no match if move wasn't found in a main line variation
        match = currVar >= 0;
      }

      // if the variation move does not match
      if (
        currVar >= 0 &&
        this.variations[currVar].moves[ii - this.variations[currVar].moveNr + 1]
          .san !== moves[i]
      ) {
        let found = false;
        // not a match, check child variations
        for (let x = 0; x < this.variations.length; x++) {
          if (
            this.variations[x].parent == this.variations[currVar].parent &&
            this.variations[x].moveNr == ii + 1 &&
            this.variations[x].moves[0].san == moves[i]
          ) {
            // move found in child variation
            currVar = x;
            found = true;

            break;
          }
        }

        // no match if move wasn't found
        match = found;
      }
    }

    // create a game to make the moves
    const game = new MyChess();
    if (this.initialFen != "") {
      game.load(this.initialFen);
    }

    //console.log('PgnField - addVariation - make moves', moveNr, this.history);

    // play all moves up to moveNr - 1
    for (let i = 0; i < moveNr - 1; i++) {
      game.move(this.history[i].san);
    }

    // play all the new moves
    let madeMoves = [];
    for (let i = 0; i < moves.length; i++) {
      game.move(moves[i]);
      madeMoves.push(game.history({ verbose: true }).pop());
    }

    // always add as a variation
    this.variations.push({
      moveNr: moveNr,           // starting move number
      parent: currVar >= 0 ? currVar : null, // attach to parent if one was found
      moves: madeMoves,
    });

    // return the index of the newly added variation
    return this.variations.length - 1;
  }

  /**
   * Toggle the use of links.
   * 
   * @param {bool} toggle 
   */
  setPgnWithLinks(toggle = true) {
    this.options.withLinks = toggle;
    // update the pgn field
    this.updatePgnField();
  }

  /**
   * Updates the PGN container with the current PGN and variations (optionally).
   */
  updatePgnField() {

    console.log('PgnField - updatePgnField:', this.pgnField, this.options?.pauseUpdate);

    // If we have a container element and updating is not paused
    if (this.pgnField && !this.options?.pauseUpdate) {
      this.getPgn(this.options.useVariations, this.pgnField);
    }
  }

  /**
   * Builds a PGN string and renders the PGN in the container element.
   * Uses text or links depending on current settings.
   * 
   * @param {bool} withVariations - Include variations.
   * @param {element} pgnField    - The container element to render the PGN in (allows for custom overrides from extended classes).
   * @returns 
   */
  getPgn(withVariations = true, pgnField = null) {
    let pgn = "";

    console.log('PgnField.getPgn', withVariations, pgnField, this.history);

    if (pgnField) {
      pgnField.innerHTML = "";

      // if there are no moves yet, add the 1.
      if (this.history.length == 0) {
        // create the move-group span
        const groupSpan = document.createElement('span');
        groupSpan.className = 'pgn-move-group';
        // create the move number span
        const nrSpan = document.createElement('span');
        nrSpan.classList.add('pgn-text');
        // If we have an emptyText option, show that instead of 1.
        if (this.options.emptyText && this.options.emptyText != "") {
          nrSpan.innerHTML = this.options.emptyText;
        } else {
          nrSpan.classList.add('move-number');
          nrSpan.innerHTML = '1.';
        }

        groupSpan.appendChild(nrSpan);
        pgnField.appendChild(groupSpan);
      }
    }

    // make sure we have the currentMove
    const currentMove = this.currentMove == -1 ? this.history.length : this.currentMove;

    //console.log("PgnField getPgn", withVariations, this.currentMove, this.history, this.options);

    let groupSpan = null;
    // loop through the moves
    for (let i = 0; i < this.history.length; i++) {
      const moveNr = Math.floor(i / 2) + 1;

      if (i % 2 == 0) {
        // add the previous group span
        if (i > 0) {
          if (pgnField && groupSpan) {
            pgnField.appendChild(groupSpan);
          }
        }

        // create the move-group span
        groupSpan = document.createElement('span');
        groupSpan.className = 'pgn-move-group';

        pgn += moveNr + ". ";

        if (pgnField) {
          const nrSpan = document.createElement("span");
          nrSpan.className = 'pgn-text move-number';
          nrSpan.innerHTML = moveNr + ".";

          groupSpan.appendChild(nrSpan);
        }
      }

      pgn += this.history[i].san + " ";

      if (pgnField) {
        const moveSpan = document.createElement("span");

        //console.log('getPgn - currentMove:', i, this.history.length, this.options);

        // Add move or text styling
        if (this.options.withLinks && !(this.options.useTextForLastMove && i + 1 == this.history.length)) {
          moveSpan.classList.add('pgn-move');
        } else {
          moveSpan.classList.add('pgn-text');
        }
        // Add current move styling (unless we dont want to highlight the last move and it is)
        if (
          this.currentVariation == -1 && currentMove == i + 1 &&
          (this.options.highlightLastMove || i + 1 < this.history.length)
        ) {
          moveSpan.classList.add('current-move')
        }

        moveSpan.innerHTML = this.history[i].san;
        moveSpan.setAttribute("data-move", i + 1);

        // add event listener
        if (this.options.withLinks) {
          moveSpan.addEventListener("click", (event) => {
            // goto a certain move
            this.gotoMove(event.target.getAttribute("data-move"));
          });
        }

        groupSpan.appendChild(moveSpan);
      }

      // Add variations if included
      if (this.options.useVariations && withVariations) {
        this.addPgnVariations(i, pgnField, groupSpan);
      }
    }

    // Add the current group span and reset it
    if (pgnField && groupSpan) {
      pgnField.appendChild(groupSpan);
      groupSpan = null;
    }

    // Add variations if included
    if (this.options.useVariations && withVariations) {
      this.addPgnVariations(this.history.length, pgnField, groupSpan);
    }

    return pgn.trim();
  }

  /**
   * Adds a variation to the PGN.
   * 
   * @param {int} i             - The variation index.
   * @param {element} pgnField  - The container element.
   * @param {element} groupSpan - The current group span. 
   * @returns 
   */
  addPgnVariations(i, pgnField, groupSpan) {
    let groupRecreated = false;
    let pgn = '';
    for (let x = 0; x < this.variations.length; x++) {
      if (
        this.variations[x].parent == null &&
        this.variations[x].moveNr == i + 1
      ) {
        // Add the current group span and reset it
        if (pgnField && !groupRecreated && groupSpan) {
          pgnField.appendChild(groupSpan);
          // recreate the move-group span
          groupSpan = document.createElement('span');
          groupSpan.className = 'pgn-move-group';
        }
        pgn += this.getPgnForVariation(i, x, pgnField);
      }
    }
    return pgn;
  }

  /**
   * Gets the PGN for a variation.
   * 
   * @param {int} i            - The variation index.
   * @param {int} x            - The variation move index.
   * @param {element} pgnField - The container element.
   * @returns 
   */
  getPgnForVariation(i, x, pgnField) {
    let pgn = '<span class="pgn-moves-variation">(';

    if (pgnField) {
      const sp = document.createElement("span");
      sp.classList.add('is-variation');
      sp.classList.add('pgn-text');

      sp.innerHTML = "(";

      pgnField.appendChild(sp);
    }

    let moveNr = Math.floor(i / 2) + 1;

    if (i % 2 == 1) {
      pgn += moveNr + "... ";

      if (pgnField) {
        const sp = document.createElement("span");
        sp.classList.add('is-variation');
        sp.classList.add('pgn-text');
        sp.innerHTML = moveNr + "...";
        pgnField.appendChild(sp);
      }
    }

    for (let y = 0; y < this.variations[x].moves.length; y++) {
      // get the move number
      moveNr = Math.floor((i + y) / 2) + 1;

      if ((i + y) % 2 == 0) {
        pgn += moveNr + ". ";

        if (pgnField) {
          const sp = document.createElement("span");
          sp.classList.add('is-variation');
          sp.classList.add('pgn-text');
          sp.classList.add('move-number');
          sp.innerHTML = moveNr + ".";
          pgnField.appendChild(sp);
        }
      }
      pgn += this.variations[x].moves[y].san + " ";

      if (pgnField) {
        const sp = document.createElement("span");
        sp.classList.add('is-variation');

        // Add move or text styling
        if (this.options.withLinks) {
          sp.classList.add('pgn-move');
        } else {
          sp.classList.add('pgn-text');
        }

        // Add current move styling
        if (this.currentVariation == x && this.currentMove == i + y + 1) {
          sp.classList.add('current-move');
        }

        sp.innerHTML = this.variations[x].moves[y].san;
        sp.setAttribute("data-variation", x);
        sp.setAttribute("data-move", i + y + 1);

        // add event listener
        if (this.options.withLinks) {
          sp.addEventListener("click", (event) => {
            // goto a certain move
            this.gotoMove(
              event.target.getAttribute("data-move"),
              event.target.getAttribute("data-variation")
            );
          });
        }

        pgnField.appendChild(sp);
      }

      // look for any sub-variations from this point
      for (let z = 0; z < this.variations.length; z++) {
        if (
          this.variations[z].parent == x &&
          this.variations[z].moveNr == i + y + 1
        ) {
          pgn += this.getPgnForVariation(i + y, z, pgnField);
        }
      }
    }
    pgn += ")</span>";

    if (pgnField) {
      const sp = document.createElement("span");
      sp.classList.add('is-variation');
      sp.classList.add('pgn-text');

      sp.innerHTML = ")";

      pgnField.appendChild(sp);
    }

    return pgn;
  }
}

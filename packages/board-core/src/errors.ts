/** Base error for failures raised by the board engine. */
export class BoardError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

/** The caller supplied a value that cannot form a valid board state. */
export class BoardInputError extends BoardError {}

/** The requested entity does not exist. */
export class BoardNotFoundError extends BoardError {}

/** The requested mutation conflicts with existing canonical state. */
export class BoardConflictError extends BoardError {}

/** The engine has been destroyed and can no longer be used. */
export class BoardDestroyedError extends BoardError {
  constructor() {
    super('Board engine has been destroyed.')
  }
}

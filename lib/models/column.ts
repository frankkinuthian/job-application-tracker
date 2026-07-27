import mongoose, { Schema, Document } from "mongoose";

export interface IColumn extends Document {
  name: string;
  boardId: mongoose.Types.ObjectId;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// Board -> Columns, and JobApplication.columnId points back at its column.
// Membership is derived from that field rather than a ref array on the column,
// so moving a card is a single write and the two sides can't drift apart.

const ColumnSchema = new Schema<IColumn>(
  {
    name: {
      type: String,
      required: true,
    },
    boardId: {
      type: Schema.Types.ObjectId,
      ref: "Board",
      required: true,
      index: true,
    },
    order: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.models.Column ||
  mongoose.model<IColumn>("Column", ColumnSchema);

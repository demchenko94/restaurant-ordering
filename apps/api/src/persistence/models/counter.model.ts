import { model, Schema } from 'mongoose';

interface CounterDoc {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterDoc>({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

export const CounterModel = model<CounterDoc>('Counter', counterSchema, 'counters');

export type CounterName = 'menuRevision' | 'orderNumber';

/** Atomically increments a named counter and returns the new value. */
export async function nextCounter(name: CounterName): Promise<number> {
  const doc = await CounterModel.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  ).lean();
  return doc.seq;
}

export async function readCounter(name: CounterName): Promise<number> {
  const doc = await CounterModel.findById(name).lean();
  return doc?.seq ?? 0;
}

import { CounterModel, type CounterName } from './counter.entity';

/** Named atomic counters: the menu revision and the human-friendly order number. */
export class CounterRepository {
  /** Atomically increments the counter and returns the new value. */
  async next(name: CounterName): Promise<number> {
    const doc = await CounterModel.findOneAndUpdate(
      { _id: name },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' },
    ).lean();
    return doc.seq;
  }

  async current(name: CounterName): Promise<number> {
    const doc = await CounterModel.findById(name).lean();
    return doc?.seq ?? 0;
  }
}

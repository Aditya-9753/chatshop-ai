const mongoose = require("mongoose");

// Integer paise field. Every money field in the EMI module uses this.
const Money = (extra = {}) => ({
  type: Number,
  default: 0,
  validate: { validator: Number.isInteger, message: "{PATH} paise me integer hona chahiye" },
  ...extra,
});

const QUERY_HOOKS = [
  "find",
  "findOne",
  "countDocuments",
  "findOneAndUpdate",
  "findOneAndDelete",
  "updateOne",
  "updateMany",
  "deleteOne",
  "deleteMany",
  "distinct",
];

/**
 * Every business collection belongs to one tenant (shop). This adds the
 * tenantId field and refuses any query or aggregate that does not filter on
 * it, so one shop can never read another's data by mistake. Super Admin
 * reports that span shops opt out with { allTenants: true }:
 *   Model.find(filter).setOptions({ allTenants: true })
 *   Model.aggregate(pipeline).option({ allTenants: true })
 */
function tenantScope(schema) {
  schema.add({ tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true } });

  schema.pre(QUERY_HOOKS, function () {
    if (this.getOptions().allTenants) return;
    const filter = this.getFilter();
    if (!filter || filter.tenantId == null) {
      throw new Error(`${this.model.modelName}: tenantId ke bina query nahi chalegi`);
    }
  });

  schema.pre("aggregate", function () {
    if (this.options.allTenants) return;
    const first = this.pipeline()[0];
    if (!first?.$match || first.$match.tenantId == null) {
      throw new Error(`${this._model?.modelName || "aggregate"}: pehla $match tenantId par hona chahiye`);
    }
  });
}

module.exports = { tenantScope, Money };

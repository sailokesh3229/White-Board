import mongoose from "mongoose";

const accountSchema = new mongoose.Schema({
  userId: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  passwordHash: { type: String, required: true },
}, { timestamps: true });
const sessionSchema = new mongoose.Schema({
  tokenHash: { type: String, unique: true, required: true },
  userId: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true, expires: 0 },
});
const Account = mongoose.model("Account", accountSchema);
const LoginSession = mongoose.model("LoginSession", sessionSchema);

export function mongoAuthStore() {
  return {
    init: () => Promise.all([Account.init(), LoginSession.init()]),
    findEmail: email => Account.findOne({ email }).lean(),
    findUser: userId => Account.findOne({ userId }).lean(),
    createUser: data => Account.create(data),
    createSession: data => LoginSession.create(data),
    findSession: tokenHash => LoginSession.findOne({ tokenHash, expiresAt: { $gt: new Date() } }).lean(),
    deleteSession: tokenHash => LoginSession.deleteOne({ tokenHash }),
  };
}

export function memoryAuthStore() {
  const users = new Map(), sessions = new Map();
  return {
    findEmail: async email => [...users.values()].find(user => user.email === email),
    findUser: async id => users.get(id),
    createUser: async data => {
      if ([...users.values()].some(user => user.email === data.email)) throw Object.assign(new Error("Duplicate email"), { code: 11000 });
      users.set(data.userId, data); return data;
    },
    createSession: async data => sessions.set(data.tokenHash, data),
    findSession: async hash => { const session = sessions.get(hash); return session?.expiresAt > new Date() ? session : null; },
    deleteSession: async hash => sessions.delete(hash),
  };
}

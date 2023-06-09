require("dotenv").config();
const { Sequelize } = require("sequelize");
const { sequelize } = require("../service/db");

const AchievementModel = require("./achievement.js");
const UserModel = require("./user.js");
const AdminModel = require("./admin.js");
const TextModel = require("./text.js");
const ThemeModel = require("./theme.js");
const SentenceModel = require("./sentence.js");
const MessageMenuModel = require("./messageMenu.js");
const UserSentenceSpecificationModel = require("./userSentenceSpecification");

const UserAchievement = require("./userAchievement.js")(sequelize, Sequelize.DataTypes);
const Achievement = AchievementModel(sequelize, Sequelize.DataTypes);
const User = UserModel(sequelize, Sequelize.DataTypes);
const Admin = AdminModel(sequelize, Sequelize.DataTypes);
const Text = TextModel(sequelize, Sequelize.DataTypes);
const Theme = ThemeModel(sequelize, Sequelize.DataTypes);
const Sentence = SentenceModel(sequelize, Sequelize.DataTypes);
const UserSentenceSpecification = UserSentenceSpecificationModel(sequelize, Sequelize.DataTypes);
const MessageMenu = MessageMenuModel(sequelize, Sequelize.DataTypes);

const models = {
  User: User,  
  Admin: Admin,  
  Achievement: Achievement,
  UserAchievement: UserAchievement,
  Text: Text,
  Theme: Theme,
  Sentence: Sentence,
  UserSentenceSpecification: UserSentenceSpecification,
  MessageMenu: MessageMenu,
};
// Associations UserAchievement
User.belongsToMany(Achievement, {
  through: UserAchievement,
  foreignKey: 'user_id',
  otherKey: 'achievement_id'
});
Achievement.belongsToMany(User, {
  through: UserAchievement,
  foreignKey: 'achievement_id',
  otherKey: 'user_id'
});

// Associations UserAchievement
User.hasMany(UserAchievement, {
  foreignKey: "user_id",
  sourceKey: "id",
});
UserAchievement.belongsTo(User, {
  foreignKey: "user_id",
  targetKey: "id",
});

Achievement.hasMany(UserAchievement, {
  foreignKey: "achievement_id",
  sourceKey: "id",
});
UserAchievement.belongsTo(Achievement, {
  foreignKey: "achievement_id",
  targetKey: "id",
});

Text.hasMany(Sentence, {
  foreignKey: "text_id",
  sourceKey: "id",
});
Sentence.belongsTo(Text, {
  foreignKey: "text_id",
  targetKey: "id",
});
User.hasMany(UserSentenceSpecification, {
  foreignKey: "user_id",
  sourceKey: "id",
});
UserSentenceSpecification.belongsTo(User, {
  foreignKey: "user_id",
  targetKey: "id",
});

Text.hasMany(UserSentenceSpecification, {
  foreignKey: "text_id",
  sourceKey: "id",
});
UserSentenceSpecification.belongsTo(Text, {
  foreignKey: "text_id",
  targetKey: "id",
});

sequelize.sync();

module.exports = models;
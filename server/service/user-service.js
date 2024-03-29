const UserModel = require("../models/user-model");
const TokenModel = require("../models/token-model");
const bcrypt = require("bcrypt");
const uuid = require("uuid");
const mailService = require("./mail-service");
const tokenService = require("./token-service");
const UserDto = require("../dtos/user-dto");
const TransactionsDto = require("../dtos/transactions-dto");
const ApiError = require("../exceptions/api-error");

const applyDto = (user) => {
    let userDto = (new UserDto(user));
    userDto.transactions = userDto.transactions.map(trns => new TransactionsDto(trns));
    userDto.transactionsFromBank = userDto.transactionsFromBank.map(trns => new TransactionsDto(trns));
    return userDto;
};

class UserService {
    async registration(email, password, firstName, lastName, avatar) {
        const candidate = await UserModel.findOne({email});
        if (candidate) {
            throw ApiError.BadRequest(`User with email ${email} already exists`)
        }
        const hashPassword = await bcrypt.hash(password, 3);
        const activationLink = uuid.v4(); // v34fa-asfasf-142saf-sa-asf

        const user = await UserModel.create({
            email,
            password: hashPassword,
            firstName,
            lastName,
            avatar,
            activationLink
        });
        await mailService.sendActivationMail(email, `${process.env.API_URL}/api/activate/${activationLink}`);

        const userDto = applyDto(user);
        const tokens = tokenService.generateTokens({id: userDto.id});
        await tokenService.saveToken(userDto.id, tokens.refreshToken);

        return {...tokens, user: userDto}
    }

    async activate(activationLink) {
        const user = await UserModel.findOne({activationLink});
        if (!user) {
            throw ApiError.BadRequest("Incorrect activation link")
        }
        user.isActivated = true;
        await user.save();
    }

    async requestPasswordReset(email) {
        const user = await UserModel.findOne({email});
        if (!user) {
            throw ApiError.BadRequest("Email does not exist");
        }

        const userDto = applyDto(user);
        if (!userDto.isActivated) {
            throw ApiError.BadRequest("Email does not activated");
        }

        let token = await TokenModel.findOne({ user: userDto.id });
        if (token) await token.deleteOne();

        const {refreshToken, resetToken} = tokenService.generateTokens({id: userDto.id});
        // await tokenService.saveToken(userDto.id, tokens.refreshToken);
        await TokenModel.create({user: userDto.id, refreshToken, resetToken, createdAt: Date.now()});

        const link = `${process.env.CLIENT_URL}/reset-password/${resetToken}/${userDto.id}`;

        await mailService.sendResetMail(userDto.email, link);

        return link;
    }

    async resetPassword(userId, resetToken, password) {
        let passwordResetToken = await TokenModel.findOne({ user: userId });

        if (!passwordResetToken) {
            throw ApiError.BadRequest("Invalid or expired password reset token");
        }

        const userData = tokenService.validateResetToken(resetToken);
        if (!userData) {
            throw ApiError.BadRequest("Invalid or expired password reset token")
        }

        const hashPassword = await bcrypt.hash(password, 3);

        await UserModel.updateOne(
            { _id: userId },
            { $set: { password: hashPassword } },
            { new: true }
        );

        const user = await UserModel.findById({ _id: userId });
        const userDto = applyDto(user);
        await mailService.sendSuccessMail(userDto.email);
        await passwordResetToken.deleteOne();

        return true;
    }

    async login(email, password) {
        const user = await UserModel.findOne({email});
        if (!user) {
            throw ApiError.BadRequest("No user exists with such email")
        }
        const isPassEquals = await bcrypt.compare(password, user.password);
        if (!isPassEquals) {
            throw ApiError.BadRequest("Incorrect password");
        }
        const userDto = applyDto(user);
        const tokens = tokenService.generateTokens({id: userDto.id});

        await tokenService.saveToken(userDto.id, tokens.refreshToken);
        return {...tokens, user: userDto}
    }

    async logout(refreshToken) {
        const token = await tokenService.removeToken(refreshToken);
        return token;
    }

    async refresh(refreshToken) {
        if (!refreshToken) {
            throw ApiError.UnauthorizedError();
        }
        const userData = tokenService.validateRefreshToken(refreshToken);
        const tokenFromDb = await tokenService.findToken(refreshToken);
        if (!userData || !tokenFromDb) {
            throw ApiError.UnauthorizedError();
        }
        const user = await UserModel.findById(userData.id);
        const userDto = applyDto(user);
        const tokens = tokenService.generateTokens({id: userDto.id});

        await tokenService.saveToken(userDto.id, tokens.refreshToken);
        return {...tokens, user: userDto}
    }

    async addTransaction(userId, date, category, value) {
        await UserModel
            .findById(userId)
            .updateOne(
                {},
                {$push: {"transactions": {date: date, category: category, value: value}}},
                {new: true});

        const user = await UserModel.findById(userId);
        return applyDto(user).transactions;
    }

    async deleteTransaction(userId, trnsId) {
        await UserModel
            .findById(userId)
            .updateOne(
                {},
                {$pull: {"transactions": {_id: trnsId}}},
                {multi: true});

        const user = await UserModel.findById(userId);
        return applyDto(user).transactions;
    }

    async addTransactionsFromBank(userId, trnsList) {
        await UserModel
            .findById(userId)
            .updateOne(
                {},
                {$set: {"transactionsFromBank": trnsList}},
                {new: true});

        const user = await UserModel.findById(userId);
        return applyDto(user).transactionsFromBank;
    }
}

module.exports = new UserService();

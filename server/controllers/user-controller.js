const userService = require("../service/user-service");
const {validationResult} = require("express-validator");
const ApiError = require("../exceptions/api-error");

class UserController {
    async registration(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return next(ApiError.BadRequest("Validation error", errors.array()))
            }
            const {email, password, firstName, lastName, avatar} = req.body;
            const userData = await userService.registration(email, password, firstName, lastName, avatar);
            res.cookie("refreshToken", userData.refreshToken, {maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true});
            return await res.json(userData);
        } catch (e) {
            next(e);
        }
    }

    async login(req, res, next) {
        try {
            const {email, password} = req.body;
            const userData = await userService.login(email, password);
            res.cookie("refreshToken", userData.refreshToken, {maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true});
            return await res.json(userData);
        } catch (e) {
            next(e);
        }
    }

    async logout(req, res, next) {
        try {
            const {refreshToken} = req.cookies;
            const token = await userService.logout(refreshToken);
            res.clearCookie("refreshToken");
            return await res.json(token);
        } catch (e) {
            next(e);
        }
    }

    async activate(req, res, next) {
        try {
            const activationLink = req.params.link;
            await userService.activate(activationLink);
            return res.redirect(307, process.env.CLIENT_URL);
        } catch (e) {
            next(e);
        }
    }

    async requestPasswordReset(req, res, next) {
        try {
            const {email} = req.body;
            const requestPasswordResetService = await userService.requestPasswordReset(email);
            return await res.send();
        } catch (e) {
            next(e);
        }
    }

    async resetPassword(req, res, next) {
        try {
            const {userId, resetToken, password} = req.body;
            await userService.resetPassword(userId, resetToken, password);
            return await res.send();
        } catch (e) {
            next(e);
        }
    }

    async refresh(req, res, next) {
        try {
            const {refreshToken} = req.cookies;
            const userData = await userService.refresh(refreshToken);
            res.cookie("refreshToken", userData.refreshToken, {maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true});
            return await res.json(userData);
        } catch (e) {
            next(e);
        }
    }

    async addTransaction(req, res, next) {
        try {
            const {date, category, value} = req.body;
            const userTransactions = await userService.addTransaction(req.user.id, date, category, value);
            return await res.json(userTransactions);
        } catch (e) {
            next(e);
        }
    }

    async deleteTransaction(req, res, next) {
        try {
            const {id} = req.body;
            const userTransactions = await userService.deleteTransaction(req.user.id, id);
            return await res.json(userTransactions);
        } catch (e) {
            next(e);
        }
    }

    async addTransactionsFromBank(req, res, next) {
        try {
            const {trnsList} = req.body;
            const userTransactionsFromBank = await userService.addTransactionsFromBank(req.user.id, trnsList);
            return await res.json(userTransactionsFromBank);
        } catch (e) {
            next(e);
        }
    }
}


module.exports = new UserController();

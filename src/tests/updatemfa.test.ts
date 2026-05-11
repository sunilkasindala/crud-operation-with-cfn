import { log } from "../utils/logger"
import { enableMFA } from "../handler/updateMfaStatus"
import { updateMfastatus } from "../utils/cognitohelper"

jest.mock("../utils/logger", () => ({
    log: { info: jest.fn(), error: jest.fn() }
}))

jest.mock("../utils/cognitohelper", () => ({
    updateMfastatus: jest.fn()
}))

describe("updateMfastatus test cases", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    })
    it("should return 400 when mfaEnabled is not boolean", async () => {
        //arrange
        const event: any = {
            requestContext: {
                authorizer: {
                    jwt: {
                        claims: {
                            sub: "user123"
                        }
                    }
                }
            },
            body: JSON.stringify({
                mfaEnabled: "true"
            })
        };
        //act 
        const result: any = await enableMFA(event)
        //assert
        expect(result.statusCode).toBe(400)
        expect(JSON.parse(result.body).message).toBe("mfaEnabled must be true or false")
    })
    it("should enable MFA successfully", async () => {
        (updateMfastatus as jest.Mock).mockResolvedValue(undefined);
        //arrange 
        const event: any = {
            requestContext: {
                authorizer: {
                    jwt: {
                        claims: {
                            sub: "user123"
                        }
                    }
                }
            },
            body: JSON.stringify({
                mfaEnabled: true
            })
        }
        //act 
        const result:any = await enableMFA(event)
        //assert 
        expect(updateMfastatus).toHaveBeenCalledWith("user123",true);
        expect(result.statusCode).toBe(200)
        expect(JSON.parse(result.body).message).toBe("MFA is enabled successfully")
    })
    it("should disable MFA successfully", async () => {
        (updateMfastatus as jest.Mock).mockResolvedValue(undefined)

        //arrange 
        const event: any = {
            requestContext: {
                authorizer: {
                    jwt: {
                        claims: {
                            sub: "user123"
                        }
                    }
                }
            },
            body: JSON.stringify({
                mfaEnabled: false
            })
        }
        //act 
        const result:any = await enableMFA(event)
        //assert
        expect(updateMfastatus).toHaveBeenCalledWith("user123",false)
        expect(result.statusCode).toBe(200)
        expect(JSON.parse(result.body).message).toBe("MFA is disabled successfully")
    })
    it("should return 500 when helper throws error",async () => {
        (updateMfastatus as jest.Mock).mockRejectedValue(
            new Error("AWS failure")
        )
        //arrange 
        const event:any = {
            requestContext: {
                authorizer: {
                    jwt: {
                       claims: {
                            sub: "user123"
                       } 
                    }
                }
            },
            body:JSON.stringify({
                mfaEnabled: true
            })
        }
        //act 
        const result:any  = await enableMFA(event)
        //asssert
        expect(result.statusCode).toBe(500)
        expect(JSON.parse(result.body).message).toBe("internal server error")
        expect(log.error).toHaveBeenCalled();
    })
})
import sgMail from '@sendgrid/mail';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { Api } from '../api';

describe('Stripe API Module Library', () => {
  let stub: sinon.SinonStub;
  stub = sinon.stub(sgMail, 'send');

  afterAll(() => {
    stub.restore();
  });

  it('check test env has valid STRIPE_API_SECRET_KEY', async () => {
    if (!process.env.STRIPE_API_SECRET_KEY) {
      throw new Error('v not set');
    }
  });

  it('check test env has valid STRIPE_CLIENT_ID', async () => {
    if (!process.env.STRIPE_CLIENT_ID) {
      throw new Error('v not set');
    }
  });

  it('check test env has valid REDIRECT_URI', async () => {
    if (!process.env.REDIRECT_URI) {
      throw new Error('v not set');
    }
  });

  describe('setCredential', function () {
    const api = new Api();

    it('should set the credentials', async () => {
      api.setAccessToken('test_access_token');
      api.setRefreshToken('test_refresh_token');
      api.setStripeUserId('test_stripe_user_id');
      expect(api.access_token).to.equal('test_access_token');
      expect(api.refresh_token).to.equal('test_refresh_token');
      expect(api.stripe_user_id).to.equal('test_stripe_user_id');
    });
  });

  describe('getAuthUri', function () {
    const api = new Api();

    it('should return a valid auth uri', async () => {
      const uri = await api.getAuthUri();
      expect(uri).to.equal(
        `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${process.env.STRIPE_CLIENT_ID}&scope=read_write&redirect_uri=${process.env.REDIRECT_URI}&state=${JSON.stringify({ app: 'stripe' })}`,
      );
    });
  });

  describe('getAccountDetails', function () {
    const api = new Api();

    it('should return a valid account', async () => {
      const testAccount = {
        id: 'acct_1J9Z1wKZ2Z2Z2Z2Z',
        object: 'account',
        business_profile: {
          mcc: '5734',
          name: 'Stripe',
          product_description: 'Stripe',
        },
      };
      //stub _get function
      const stub = sinon.stub(api, '_get');
      stub.resolves(testAccount);
      var callback = sinon.spy();

      const account = await api.getAccountDetails();

      expect(account).to.equal(testAccount);
    });
  });
});

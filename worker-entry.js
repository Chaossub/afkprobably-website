import baseWorker
from './worker.js';

import {
  handleCommissionApi
}
from './commission-api.js';


export default {

  async fetch(
    request,
    env,
    ctx
  ) {

    const url =
      new URL(
        request.url
      );


    const commissionResponse =
      await handleCommissionApi(
        request,
        env,
        url
      );


    if (
      commissionResponse
    ) {

      return commissionResponse;

    }


    return baseWorker.fetch(
      request,
      env,
      ctx
    );

  }

};

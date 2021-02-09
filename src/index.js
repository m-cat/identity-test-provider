import Postmate from "postmate";

const identityKey = 'identity';


if (typeof(Storage) == 'undefined') {
  throw new Error('Browser does not support web storage')
}

// Launch the provider.
const provider = new IdentityProvider();

export class IdentityProvider {
  constructor() {
  }
}

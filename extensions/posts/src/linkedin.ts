/**
 * How this package reaches LinkedIn, and everything about LinkedIn there is.
 *
 * One of four files like this, one per network, so that adding a network is a
 * file beside this one rather than a condition inside every column. Nothing in
 * it touches a record or a screen: it takes a token and some text, and answers
 * with what the network said. Which of the four is called is decided in
 * `networks.ts`.
 */

import { Refused, ask, brief, read, said, text, type Door } from "./door";

/** Where the API lives. Also one of the hosts the manifest declares. */
const HOST = "https://api.linkedin.com";

/**
 * Which monthly version of the API this package speaks.
 *
 * LinkedIn versions by month and sunsets a version about a year after it ships,
 * so this is a value that has to move — and it moves with a release of this
 * package, deliberately. A number read from a record would let a project pin
 * itself to a version that has since been switched off, and discover it at the
 * moment it published.
 */
const VERSION = "202608";

/** What is true of every request here. */
const headers = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  "Linkedin-Version": VERSION,
  "X-Restli-Protocol-Version": "2.0.0",
});

/** Who a token belongs to, as LinkedIn answers it. */
export interface Whose {
  /** The author URN a post is published as. */
  readonly author: string;
  /** The person's name, for the row a human reads. */
  readonly account: string;
}

/**
 * Ask LinkedIn who a token is for.
 *
 * Called before a token is stored rather than after, which is the whole point
 * of it: a token that will not answer here is one that would have failed at the
 * moment somebody pressed Publish, and finding that out while they are still
 * looking at the field costs nothing.
 *
 * It also spares somebody hunting for their own URN. `sub` is the id LinkedIn
 * identifies them by, and the author of a post is that id spelled as a URN —
 * so the one thing the network insists on is read from the network.
 */
export async function whose(net: Door, token: string): Promise<Whose> {
  const answer = await ask(net, {
    url: `${HOST}/v2/userinfo`,
    headers: headers(token),
  });

  if (answer.status === 401) {
    throw new Refused(
      "LinkedIn did not accept that token. A token from the developer portal lasts sixty days, and one that has run out looks exactly like one that was mistyped.",
    );
  }
  if (answer.status === 403) {
    throw new Refused(
      "That token is not allowed to say who it belongs to. The app it came from needs the “Sign In with LinkedIn using OpenID Connect” product, which is added in the developer portal and needs no review.",
    );
  }
  if (!answer.ok) throw new Refused(said("LinkedIn", answer));

  const parsed = read(answer.body);
  const sub = text(parsed.sub);
  if (sub === "") {
    throw new Refused("LinkedIn answered without saying who the token belongs to.");
  }

  return {
    author: `urn:li:person:${sub}`,
    // Not every account has every part of a name, and a channel row showing
    // nothing is worse than one showing an id.
    account: text(parsed.name) || text(parsed.email) || sub,
  };
}

/** One post, as it goes out. */
export interface Outgoing {
  readonly token: string;
  /** The author URN, as `whose` read it back. */
  readonly author: string;
  readonly text: string;
  /** `public` or `connections`, in this package's own vocabulary. */
  readonly visibility: string;
}

/**
 * Publish one text post, and answer with what the network called it.
 *
 * The identifier comes out of a **response header**, `x-restli-id`, and not out
 * of the body — the body of a successful create is empty. That is the whole
 * reason this package needs response headers at all, and it is what makes the
 * publication record a receipt rather than a claim: the id was issued by
 * LinkedIn and read from its answer.
 */
export async function post(net: Door, outgoing: Outgoing): Promise<string> {
  const answer = await ask(net, {
    url: `${HOST}/rest/posts`,
    method: "POST",
    headers: { ...headers(outgoing.token), "Content-Type": "application/json" },
    body: JSON.stringify({
      author: outgoing.author,
      commentary: outgoing.text,
      visibility: outgoing.visibility === "connections" ? "CONNECTIONS" : "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });

  if (answer.status === 401) {
    throw new Refused(
      "LinkedIn no longer accepts this channel's token. They last sixty days; connect the channel again with a fresh one.",
    );
  }
  if (answer.status === 403) {
    throw new Refused(
      "This token may not post. The app it came from needs the “Share on LinkedIn” product, which is added in the developer portal and needs no review.",
    );
  }
  if (answer.status === 422) {
    throw new Refused(`LinkedIn would not take this post as written: ${brief(answer.body)}`);
  }
  if (!answer.ok) throw new Refused(said("LinkedIn", answer));

  // Lower case, because that is how the door hands headers over — a name the
  // server spelled differently arrives here spelled one way.
  const identifier = answer.headers["x-restli-id"] ?? "";
  if (identifier === "") {
    // The post went out; LinkedIn simply did not name it. Worth saying rather
    // than failing, because failing here would lose the record of something
    // that has already happened.
    return "";
  }
  return identifier;
}

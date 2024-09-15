import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';

export const generateMerkleRoot = (wallets: string[]) => {
  // Hash wallet addresses
  let hashedWallets = wallets.map(keccak256)
  // Generate Merkle tree
  const tree = new MerkleTree(hashedWallets, keccak256, { sortPairs: true })
  const merkleRoot = tree.getRoot().toString('hex')

  return "0x" + merkleRoot
}

export const generateMerkleProof = (wallets: string[], wallet: string) => {
  // Hash wallet addresses
  let hashedWallets = wallets.map(keccak256)

  // Generate Merkle tree
  const tree = new MerkleTree(hashedWallets, keccak256, { sortPairs: true })
  const merkleRoot = tree.getRoot().toString('hex')

  const proof = tree.getProof(keccak256(wallet)).map(x => x.data.toString('hex'));

  return proof.map(p => '0x' + p)
}
import { ResolvedConfig } from './config'
import { Range } from './types'

export type Address = ResolvedConfig['AddressType']

////////////////////////////////////////////////////////////////////////////////////////////////////
// Solidity Types

// Could use `Range`, but listed out for zero overhead
// prettier-ignore
export type MBytes =
  | '' | 1  | 2  | 3  | 4  | 5  | 6  | 7  | 8  | 9
  | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19
  | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29
  | 30 | 31 | 32
// prettier-ignore
export type MBits =
  | ''  | 8   | 16  | 24  | 32  | 40  | 48  | 56  | 64  | 72
  | 80  | 88  | 96  | 104 | 112 | 120 | 128 | 136 | 144 | 152
  | 160 | 168 | 176 | 184 | 192 | 200 | 208 | 216 | 224 | 232
  | 240 | 248 | 256

// From https://docs.soliditylang.org/en/latest/abi-spec.html#types
export type SolidityAddress = 'address'
export type SolidityBool = 'bool'
export type SolidityBytes = `bytes${MBytes}` // `bytes<M>`: binary type of `M` bytes, `0 < M <= 32`
export type SolidityFunction = 'function'
export type SolidityString = 'string'
export type SolidityTuple = 'tuple'
export type SolidityInt = `${'u' | ''}int${MBits}` // `(u)int<M>`: (un)signed integer type of `M` bits, `0 < M <= 256`, `M % 8 == 0`
// No need to support "fixed" until Solidity does
// https://github.com/ethereum/solidity/issues/409
// `(u)fixed<M>x<N>`: (un)signed fixed-point decimal number of `M` bits, `8 <= M <= 256`, `M % 8 == 0`,
// and `0 < N <= 80`, which denotes the value `v` as `v / (10 ** N)`
// export type SolidityFixed =
//   | `${'u' | ''}fixed`
//   | `${'u' | ''}fixed${MBits}x${Range<1, 20>[number]}`

export type SolidityFixedArrayRange = Range<
  ResolvedConfig['FixedArrayMinLength'],
  ResolvedConfig['FixedArrayMaxLength']
>[number]
export type SolidityFixedArraySizeLookup = {
  [Prop in SolidityFixedArrayRange as `${Prop}`]: Prop
}

/**
 * Recursively build arrays up to maximum depth
 * or use a more broad type when maximum depth is switch "off"
 */
type _BuildArrayTypes<
  T extends string,
  Depth extends ReadonlyArray<number> = [],
> = ResolvedConfig['ArrayMaxDepth'] extends false
  ? `${T}[${string}]`
  : Depth['length'] extends ResolvedConfig['ArrayMaxDepth']
  ? T
  : T extends `${any}[${SolidityFixedArrayRange | ''}]`
  ? _BuildArrayTypes<T | `${T}[${SolidityFixedArrayRange | ''}]`, [...Depth, 1]>
  : _BuildArrayTypes<`${T}[${SolidityFixedArrayRange | ''}]`, [...Depth, 1]>

// Modeling fixed-length (`<type>[M]`) and dynamic (`<type>[]`) arrays
// Tuple and non-tuple versions are separated out for narrowing anywhere structs show up
export type SolidityArrayWithoutTuple = _BuildArrayTypes<
  | SolidityAddress
  | SolidityBool
  | SolidityBytes
  | SolidityFunction
  | SolidityInt
  | SolidityString
>
export type SolidityArrayWithTuple = _BuildArrayTypes<SolidityTuple>
export type SolidityArray = SolidityArrayWithoutTuple | SolidityArrayWithTuple

////////////////////////////////////////////////////////////////////////////////////////////////////
// Abi Types

export type AbiType =
  | SolidityArray
  | SolidityAddress
  | SolidityBool
  | SolidityBytes
  | SolidityFunction
  | SolidityInt
  | SolidityString
  | SolidityTuple

export type AbiInternalType =
  | AbiType
  | `address ${string}`
  | `contract ${string}`
  | `enum ${string}`
  | `struct ${string}`

export type AbiParameter = {
  type: AbiType
  name: string
  /** Representation used by Solidity compiler */
  internalType?: AbiInternalType
} & (
  | { type: Exclude<AbiType, SolidityTuple | SolidityArrayWithTuple> }
  | {
      type: SolidityTuple | SolidityArrayWithTuple
      components: readonly AbiParameter[]
    }
)

export type AbiStateMutability = 'pure' | 'view' | 'nonpayable' | 'payable'

export type AbiFunction = {
  /**
   * @deprecated use `pure` or `view` from {@link AbiStateMutability} instead
   * https://github.com/ethereum/solidity/issues/992
   */
  constant?: boolean
  /**
   * @deprecated Vyper used to provide gas estimates
   * https://github.com/vyperlang/vyper/issues/2151
   */
  gas?: number
  /**
   * @deprecated use `payable` or `nonpayable` from {@link AbiStateMutability} instead
   * https://github.com/ethereum/solidity/issues/992
   */
  payable?: boolean
  stateMutability: AbiStateMutability
} & (
  | {
      type: 'function'
      inputs: readonly AbiParameter[]
      name: string
      outputs: readonly AbiParameter[]
    }
  | {
      type: 'constructor'
      inputs: readonly AbiParameter[]
    }
  | { type: 'fallback'; inputs?: [] }
  | { type: 'receive'; stateMutability: 'payable' }
)

export type AbiEvent = {
  type: 'event'
  anonymous?: boolean
  inputs: readonly (AbiParameter & { indexed?: boolean })[]
  name: string
}

export type AbiError = {
  type: 'error'
  inputs: readonly AbiParameter[]
  name: string
}

/**
 * Contract [ABI Specification](https://docs.soliditylang.org/en/latest/abi-spec.html#json)
 */
export type Abi = readonly (AbiFunction | AbiEvent | AbiError)[]

////////////////////////////////////////////////////////////////////////////////////////////////////
// Typed Data Types

export type TypedDataDomain = {
  chainId?: string | number | bigint
  name?: string
  salt?: ResolvedConfig['BytesType']
  verifyingContract?: Address
  version?: string
}

// Subset of `AbiType` that excludes `tuple` and `function`
export type TypedDataType = Exclude<
  AbiType,
  SolidityFunction | SolidityTuple | SolidityArrayWithTuple
>

export type TypedDataParameter = {
  name: string
  type: TypedDataType | keyof TypedData | `${keyof TypedData}[${string | ''}]`
}

/**
 * [EIP-712](https://eips.ethereum.org/EIPS/eip-712#definition-of-typed-structured-data-%F0%9D%95%8A) Typed Data Specification
 */
export type TypedData = {
  [key: string]: readonly TypedDataParameter[]
} & {
  // Disallow `TypedDataType` as key names (e.g. `address`)
  [_ in TypedDataType]?: never
}

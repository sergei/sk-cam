import argparse

from tag_assisted import measure_sail_shape


def main(args):
    input_name = args.picture

    measure_sail_shape(input_name)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(fromfile_prefix_chars='@')
    parser.add_argument("picture", help="Image of the sail", default=None)

    main(parser.parse_args())

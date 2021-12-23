import argparse
import os
import glob
import numpy as np
from cv2 import aruco
import cv2

from cal_data import CalibrationData


def calibrate_camera(all_corners, all_ids, imsize):
    """
    Calibrates the camera using the dected corners.
    """
    print("CAMERA CALIBRATION")
    board, aruco_dict = make_board()

    camera_matrix_init = np.array([[1000., 0., imsize[0] / 2.],
                                   [0., 1000., imsize[1] / 2.],
                                   [0., 0., 1.]])

    dist_coeffs_init = np.zeros((5, 1))
    flags = (cv2.CALIB_USE_INTRINSIC_GUESS + cv2.CALIB_RATIONAL_MODEL + cv2.CALIB_FIX_ASPECT_RATIO)
    (ret, camera_matrix, distortion_coefficients0,
     rotation_vectors, translation_vectors,
     stdDeviationsIntrinsics, stdDeviationsExtrinsics,
     perViewErrors) = cv2.aruco.calibrateCameraCharucoExtended(
        charucoCorners=all_corners,
        charucoIds=all_ids,
        board=board,
        imageSize=imsize,
        cameraMatrix=camera_matrix_init,
        distCoeffs=dist_coeffs_init,
        flags=flags,
        criteria=(cv2.TERM_CRITERIA_EPS & cv2.TERM_CRITERIA_COUNT, 10000, 1e-9))

    fx = camera_matrix[1][1]
    fx_std = stdDeviationsIntrinsics[0][0]
    fx_err = fx_std / fx * 100
    fy = camera_matrix[1][1]
    fy_std = stdDeviationsIntrinsics[1][0]
    fy_err = fy_std / fy * 100
    cx = camera_matrix[0][2]
    cx_std = stdDeviationsIntrinsics[2][0]
    cx_err = cx_std / cx * 100
    cy = camera_matrix[1][2]
    cy_std = stdDeviationsIntrinsics[3][0]
    cy_err = cy_std / cy * 100

    print(f'fx={fx:.0f}(±{fx_err:.0f}%) px fy={fy:.0f}(±{fy_err:.0f}%)  px')
    print(f'cx={fx:.0f}(±{cx_err:.0f}%) px cy={cy:.0f}(±{cy_err:.0f}%)  px')

    aperture_width = 3.590
    aperture_height = 2.684
    fov_x, fov_y, focal_length, principal_point, aspect_ratio = cv2.calibrationMatrixValues(camera_matrix, imsize,
                                                                                            aperture_width,
                                                                                            aperture_height)
    print(f'Assuming sensor image area WxH {aperture_width}x{aperture_height} mm camera matrix is:')
    print(f'fov_x={fov_x:.1f}° fov_y={fov_y:.1f}° focal_length={focal_length:.1f}mm ')
    print(f'focal_length={focal_length:.1f}mm principal_point=({principal_point[0]:.1f}, {principal_point[1]:.1f})mm '
          f'aspect_ratio={aspect_ratio}')

    return ret, camera_matrix, distortion_coefficients0, rotation_vectors, translation_vectors


def read_chessboards(images):
    """
    Charuco base pose estimation.
    """
    print("POSE ESTIMATION STARTS:")
    all_corners = []
    all_ids = []
    decimator = 0
    # SUB PIXEL CORNER DETECTION CRITERION
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.00001)
    board, aruco_dict = make_board()

    gray = None
    for im in images:
        print("=> Processing image {0}".format(im))
        frame = cv2.imread(im)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        corners, ids, rejected_img_points = cv2.aruco.detectMarkers(gray, aruco_dict)

        if len(corners) > 6:
            # SUB PIXEL DETECTION
            for corner in corners:
                cv2.cornerSubPix(gray, corner,
                                 winSize=(3, 3),
                                 zeroZone=(-1, -1),
                                 criteria=criteria)
            res2 = cv2.aruco.interpolateCornersCharuco(corners, ids, gray, board)
            if res2[1] is not None and res2[2] is not None and len(res2[1]) > 3 and decimator % 1 == 0:
                all_corners.append(res2[1])
                all_ids.append(res2[2])

        decimator += 1

    imsize = gray.shape
    return all_corners, all_ids, imsize


def print_board():
    board, _ = make_board()
    im_board = board.draw((2000, 2000))
    cv2.imwrite("chessboard.png", im_board)


def make_board():
    aruco_dict = aruco.Dictionary_get(aruco.DICT_6X6_250)
    square_length = 30 * 1e-3  # 30 mm
    marker_length = 24 * 1e-3  # 28 mm
    squares_x = 7
    squares_y = 5
    print(f'CharucoBoard {squares_x}x{squares_y} '
          f'square_length={square_length*1000}mm marker_length={marker_length*1000}mm')
    board = aruco.CharucoBoard_create(squares_x, squares_y, square_length, marker_length, aruco_dict)
    return board, aruco_dict


def verify_calibration(mtx, dist, images):
    for in_image_name in images:
        im_dir = os.path.split(in_image_name)[0] + os.sep + 'undistort'
        os.makedirs(im_dir, exist_ok=True)
        out_image_name = im_dir + os.sep + os.path.split(in_image_name)[1]
        frame = cv2.imread(in_image_name)
        img_undist = cv2.undistort(frame, mtx, dist, None)
        cv2.imwrite(out_image_name, img_undist)


def calibrate(pict_dir):
    images = glob.glob(pict_dir + '/*.jpg')

    all_corners, all_ids, imsize = read_chessboards(images)
    ret, mtx, dist, rvecs, tvecs = calibrate_camera(all_corners, all_ids, imsize)

    calibration = CalibrationData()
    cal_dir = pict_dir + os.sep + 'calibration'
    os.makedirs(cal_dir, exist_ok=True)
    calibration.store(cal_dir + os.sep + 'calibration.json', mtx, dist)
    verify_calibration(mtx, dist, images)


def test_pose(img, cal_file):
    print("=> Processing image {0}".format(img))
    frame = cv2.imread(img)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    aruco_dict = cv2.aruco.Dictionary_get(cv2.aruco.DICT_4X4_50)
    aruco_params = cv2.aruco.DetectorParameters_create()
    (corners, ids, rejected) = cv2.aruco.detectMarkers(gray, aruco_dict,
                                                       parameters=aruco_params)

    if len(corners) > 0:
        cal = CalibrationData(cal_file)

        size_of_marker = 0.19  # 19 cm
        rvecs, tvecs, _objPoints = aruco.estimatePoseSingleMarkers(corners, size_of_marker, cal.mtx, cal.dist)
        r = tvecs[0][0]
        d = np.sqrt(r[0] ** 2 + r[1] ** 2 + r[2] ** 2)
        print('Distance to marker {} meters'.format(d))
        cv2.aruco.drawDetectedMarkers(frame, corners, ids)
    else:
        print('Tag not found')
        cv2.aruco.drawDetectedMarkers(frame, rejected)

    cv2.imshow("Detection", frame)

    cv2.waitKey(0)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(fromfile_prefix_chars='@')
    parser.add_argument("--print", action='store_true', help="Make ChArucoBoard image", default=False)
    parser.add_argument("--pict-dir", help="Make ChArucoBoard image")
    parser.add_argument("--test-pose-img", help="Make ChArucoBoard image")
    parser.add_argument("--cal-file", help="File containing camera calibration data")

    args = parser.parse_args()
    if args.print:
        print_board()
    elif args.pict_dir is not None:
        calibrate(os.path.expanduser(args.pict_dir))
    elif args.test_pose_img is not None:
        test_pose(os.path.expanduser(args.test_pose_img), os.path.expanduser(args.cal_file))
    else:
        print(parser.usage)

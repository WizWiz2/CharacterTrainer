import asyncio
import os
import shutil

async def test_launch(cmd_list, cwd=None):
    print(f"\nTesting: {cmd_list}")
    try:
        # Test exec
        p = await asyncio.create_subprocess_exec(*cmd_list, cwd=cwd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)
        out, _ = await p.communicate()
        print(f"Exec Success: {out.decode().strip()[:50]}")
    except Exception as e:
        print(f"Exec Failed: {e}")

    try:
        # Test shell
        shell_cmd = " ".join(f'"{a}"' for a in cmd_list)
        p = await asyncio.create_subprocess_shell(shell_cmd, cwd=cwd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)
        out, _ = await p.communicate()
        print(f"Shell Success: {out.decode().strip()[:50]}")
    except Exception as e:
        print(f"Shell Failed: {e}")

async def main():
    acc_path = r"C:\Users\User\AppData\Local\Packages\PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0\LocalCache\local-packages\Python313\Scripts\accelerate.exe"
    print(f"Path exists: {os.path.exists(acc_path)}")
    
    await test_launch([acc_path, "--version"])
    await test_launch(["accelerate", "--version"])
    
    # Try with python -m
    import sys
    await test_launch([sys.executable, "-m", "accelerate", "--version"])

if __name__ == "__main__":
    asyncio.run(main())
